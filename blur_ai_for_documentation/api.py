import base64
from pathlib import Path
from typing import Literal

import cv2
from fastapi import File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

try:
    from server_yolo_fastapi import (
        DEFAULT_IMGSZ,
        DEFAULT_YOLO_CONF,
        DEVICE,
        app,
        decode_upload,
        get_reader,
        process_image_fast,
        resolve_engine,
    )
except ModuleNotFoundError as exc:
    if exc.name != "server_yolo_fastapi":
        raise
    from .server_yolo_fastapi import (
        DEFAULT_IMGSZ,
        DEFAULT_YOLO_CONF,
        DEVICE,
        app,
        decode_upload,
        get_reader,
        process_image_fast,
        resolve_engine,
    )


class RedactDocumentRequest(BaseModel):
    image: str
    mode: Literal["blur", "black", "pixelate"] = "blur"


def _decode_image_payload(value: str) -> bytes:
    if value.startswith("data:"):
        try:
            return base64.b64decode(value.split(",", 1)[1])
        except Exception as exc:
            raise ValueError(f"invalid data URL: {exc}") from exc
    return Path(value).read_bytes()


def _data_url_from_bgr(image, mime: str = "image/png") -> str:
    ext = ".jpg" if mime == "image/jpeg" else ".png"
    ok, encoded = cv2.imencode(ext, image)
    if not ok:
        raise RuntimeError("Could not encode redacted image.")
    return f"data:{mime};base64,{base64.b64encode(encoded.tobytes()).decode('ascii')}"


async def _process_image_array(image, mode: Literal["blur", "black", "pixelate"]):
    actual_engine = resolve_engine("auto")
    reader = get_reader() if actual_engine in {"hybrid", "ocr"} else None

    return await run_in_threadpool(
        process_image_fast,
        image,
        reader=reader,
        yolo_model=app.state.yolo_model,
        yolo_lock=app.state.yolo_lock,
        ocr_lock=app.state.ocr_lock,
        engine=actual_engine,
        mode=mode,
        conf=DEFAULT_YOLO_CONF,
        imgsz=DEFAULT_IMGSZ,
        redact_photo=False,
        rotation_ocr=False,
        ocr_passes="fast",
    )


@app.post("/api/redact-document")
async def redact_document(payload: RedactDocumentRequest):
    try:
        raw = _decode_image_payload(payload.image)
        image = decode_upload(raw)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not decode image: {exc}") from exc

    result = await _process_image_array(image, payload.mode)
    redacted_image = result.pop("redactedImage")

    return {
        "engine": result.get("engineUsed") or "ocr",
        "mode": payload.mode,
        "sensitive_count": result.get("sensitiveCount", 0),
        "redacted_count": result.get("redactedCount", 0),
        "redacted_image": _data_url_from_bgr(redacted_image),
        "idDocumentInferred": result.get("idDocumentInferred", False),
        "extractedData": result.get("extractedData", {}),
    }


@app.post("/api/redact-image")
async def redact_image_upload_compat(
    file: UploadFile = File(...),
    mode: Literal["blur", "black", "pixelate"] = "blur",
):
    raw = await file.read()
    try:
        image = decode_upload(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    result = await _process_image_array(image, mode)
    redacted_image = result.pop("redactedImage")
    ok, encoded = cv2.imencode(".png", redacted_image)
    if not ok:
        raise HTTPException(status_code=500, detail="Could not encode redacted image.")

    return Response(
        content=encoded.tobytes(),
        media_type="image/png",
        headers={
            "Content-Disposition": 'inline; filename="redacted.png"',
            "X-Engine-Used": str(result.get("engineUsed") or "ocr"),
            "X-Sensitive-Count": str(result.get("sensitiveCount", 0)),
            "X-Redacted-Count": str(result.get("redactedCount", 0)),
            "X-Device": DEVICE,
        },
    )
