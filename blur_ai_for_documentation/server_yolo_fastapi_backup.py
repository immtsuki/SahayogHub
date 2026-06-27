#!/usr/bin/env python3
"""
FastAPI server for automatic document redaction.

Put this file in the SAME folder as your current `redact_sensitive_images_v3.py`.

It supports two engines:
1. YOLO engine when `models/sensitive_fields.pt` exists.
2. OCR fallback using your existing process_image() when YOLO model is not available.

Run:
    uvicorn server_yolo_fastapi:app --reload --host 0.0.0.0 --port 8000

Upload:
    curl -X POST "http://127.0.0.1:8000/redact?mode=blur&engine=auto" \
      -F "file=@nagrita/Pasted image (2).png"
"""
from __future__ import annotations

import json
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

import cv2
import easyocr
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

# Import your existing redaction code.
# server_yolo_fastapi.py must be beside redact_sensitive_images_v3.py.
from redact_sensitive_images_v3 import (  # type: ignore
    clamp_bbox,
    expand_bbox,
    process_image,
    redact_region,
)

try:
    from ultralytics import YOLO
except Exception:  # pragma: no cover
    YOLO = None


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", BASE_DIR / "api_output"))
UPLOAD_DIR = OUTPUT_DIR / "uploads"
MODEL_PATH = Path(os.getenv("MODEL_PATH", BASE_DIR / "models" / "sensitive_fields.pt"))
DEVICE = os.getenv("DEVICE", "cpu")  # use "0" only when torch.cuda.is_available() is true
OCR_LANGS = os.getenv("OCR_LANGS", "ne,en").split(",")

# YOLO classes that should be blurred.
DEFAULT_YOLO_REDACT_CLASSES = {
    "citizenship_no",
    "national_id_no",
    "license_no",
    "drivers_license_number",
    "passport_no",
    "passport_number",
    "phone_no",
    "phone_number",
    "dob",
    "date_of_birth",
    "issue_date",
    "date_of_issue",
    "expiry_date",
    "date_of_expiry",
    "name",
    "person_name",
    "father_name",
    "mother_name",
    "address",
    "blood_group",
    "signature",
    "qr",
}
PHOTO_CLASSES = {"photo", "face"}


def decode_upload(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode uploaded image. Use jpg/png/webp.")
    return image


def save_image(path: Path, image: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    ok = cv2.imwrite(str(path), image)
    if not ok:
        raise RuntimeError(f"Could not save image: {path}")


def yolo_redact_image(
    *,
    image_path: Path,
    output_dir: Path,
    model: Any,
    mode: str,
    conf: float,
    imgsz: int,
    redact_photo: bool,
) -> Dict[str, Any]:
    image = cv2.imread(str(image_path))
    if image is None:
        raise ValueError(f"Could not read image: {image_path}")

    originals_dir = output_dir / "originals"
    redacted_dir = output_dir / "redacted"
    json_dir = output_dir / "json"
    originals_dir.mkdir(parents=True, exist_ok=True)
    redacted_dir.mkdir(parents=True, exist_ok=True)
    json_dir.mkdir(parents=True, exist_ok=True)

    stamp = f"{int(time.time() * 1000)}_{image_path.stem}"
    original_copy = originals_dir / f"{stamp}{image_path.suffix.lower()}"
    redacted_copy = redacted_dir / f"{stamp}.redacted{image_path.suffix.lower()}"
    json_copy = json_dir / f"{stamp}.json"

    save_image(original_copy, image)

    result = model.predict(
        source=image,
        conf=conf,
        imgsz=imgsz,
        device=DEVICE,
        verbose=False,
    )[0]

    redacted = image.copy()
    detections: List[Dict[str, Any]] = []
    names = result.names if hasattr(result, "names") else model.names

    for box in result.boxes:
        cls_id = int(box.cls[0])
        category = str(names.get(cls_id, cls_id))
        score = float(box.conf[0])
        bbox = clamp_bbox(box.xyxy[0].detach().cpu().numpy().tolist(), image.shape)

        should_redact = category in DEFAULT_YOLO_REDACT_CLASSES or (redact_photo and category in PHOTO_CLASSES)
        if should_redact:
            red_box = expand_bbox(bbox, image.shape, pad=10)
            redact_region(redacted, red_box, mode)

        detections.append({
            "category": category,
            "confidence": score,
            "bbox": bbox,
            "redacted": should_redact,
            "engine": "yolo",
        })

    save_image(redacted_copy, redacted)

    payload = {
        "engine": "yolo",
        "source_image": str(image_path),
        "original_copy": str(original_copy),
        "redacted_copy": str(redacted_copy),
        "redacted_url": f"/files/redacted/{redacted_copy.name}",
        "json_url": f"/files/json/{json_copy.name}",
        "detections_count": len(detections),
        "redacted_count": sum(1 for d in detections if d["redacted"]),
        "detections": detections,
    }
    json_copy.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return payload


@asynccontextmanager
async def lifespan(app: FastAPI):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Loading OCR fallback: languages={OCR_LANGS}")
    app.state.reader = easyocr.Reader(OCR_LANGS, gpu=False)

    app.state.yolo_model = None
    if YOLO is not None and MODEL_PATH.exists():
        print(f"Loading YOLO model: {MODEL_PATH}")
        app.state.yolo_model = YOLO(str(MODEL_PATH))
    else:
        print(f"YOLO model not found at {MODEL_PATH}; API will use OCR fallback until model exists.")

    yield


app = FastAPI(title="Automatic Sensitive Document Redactor", lifespan=lifespan)
app.mount("/files", StaticFiles(directory=str(OUTPUT_DIR)), name="files")


@app.get("/")
def index():
    return {
        "message": "Automatic document redaction API is running",
        "redact_endpoint": "/redact",
        "docs": "/docs",
        "model_path": str(MODEL_PATH),
        "yolo_loaded": app.state.yolo_model is not None,
    }


@app.get("/health")
def health():
    return {
        "ok": True,
        "output_dir": str(OUTPUT_DIR),
        "model_path": str(MODEL_PATH),
        "yolo_loaded": app.state.yolo_model is not None,
        "fallback_ocr_loaded": app.state.reader is not None,
    }


@app.post("/redact")
async def redact_upload(
    file: UploadFile = File(...),
    engine: Literal["auto", "yolo", "ocr"] = "auto",
    mode: Literal["blur", "black", "pixelate"] = "blur",
    conf: float = 0.25,
    imgsz: int = 960,
    redact_photo: bool = False,
    ocr_passes: Literal["fast", "balanced", "accurate"] = "balanced",
):
    raw = await file.read()
    try:
        image = decode_upload(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    suffix = Path(file.filename or "upload.png").suffix.lower() or ".png"
    upload_path = UPLOAD_DIR / f"{int(time.time() * 1000)}_{Path(file.filename or 'upload').stem}{suffix}"
    save_image(upload_path, image)

    use_yolo = engine == "yolo" or (engine == "auto" and app.state.yolo_model is not None)

    if use_yolo:
        if app.state.yolo_model is None:
            raise HTTPException(status_code=503, detail=f"YOLO model not found at {MODEL_PATH}")
        payload = yolo_redact_image(
            image_path=upload_path,
            output_dir=OUTPUT_DIR,
            model=app.state.yolo_model,
            mode=mode,
            conf=conf,
            imgsz=imgsz,
            redact_photo=redact_photo,
        )
        return JSONResponse(payload)

    # OCR fallback: automatically uses the flags you were typing manually.
    summary = process_image(
        image_path=upload_path,
        output_dir=OUTPUT_DIR,
        reader=app.state.reader,
        mode=mode,
        strict=False,
        id_document=True,
        redact_all_text=False,
        redact_faces=redact_photo,
        protect_faces=not redact_photo,
        allow_large_redaction=False,
        keep_original=True,
        ocr_passes=ocr_passes,
        rotation_ocr=False,
        redact_dates=True,
        redact_names=False,
        redact_addresses=False,
        redact_id_fields=True,
        draw_boxes=False,
        mask_json_values=False,
    )

    payload = {
        "engine": "ocr_fallback",
        **summary,
        "redacted_url": "/files/" + str(Path(summary["redacted"]).relative_to(OUTPUT_DIR)).replace(os.sep, "/"),
        "json_url": "/files/" + str(Path(summary["json"]).relative_to(OUTPUT_DIR)).replace(os.sep, "/"),
    }
    return JSONResponse(payload)
