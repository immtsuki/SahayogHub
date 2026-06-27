import base64
import io
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from PIL import Image, ImageOps


app = FastAPI(
    title="Sahayog Sensitive Document Redactor",
    description="Redacts sensitive-looking document regions and returns a safe display image.",
)


class RedactDocumentRequest(BaseModel):
    image: str
    mode: str = "blur"


def _decode_data_url(value: str) -> tuple[Image.Image, str]:
    if value.startswith("data:"):
        header, encoded = value.split(",", 1)
        mime = header.split(";", 1)[0].replace("data:", "") or "image/png"
        raw = base64.b64decode(encoded)
    else:
        mime = "image/png"
        raw = Path(value).read_bytes()
    image = Image.open(io.BytesIO(raw))
    return ImageOps.exif_transpose(image).convert("RGB"), mime


def _data_url_from_image(image: Image.Image, mime="image/png") -> str:
    output = io.BytesIO()
    fmt = "PNG" if mime.endswith("png") else "JPEG"
    image.save(output, format=fmt, quality=92)
    encoded = base64.b64encode(output.getvalue()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def _pil_to_bgr(image: Image.Image):
    return cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2BGR)


def _bgr_to_pil(image: np.ndarray):
    return Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))


def _blur_region(image: np.ndarray, box: tuple[int, int, int, int], mode: str):
    x, y, w, h = box
    x2 = min(image.shape[1], x + w)
    y2 = min(image.shape[0], y + h)
    x = max(0, x)
    y = max(0, y)
    if x2 <= x or y2 <= y:
        return

    roi = image[y:y2, x:x2]
    if mode == "black":
        image[y:y2, x:x2] = 0
        return

    if mode == "pixelate":
        small_w = max(1, w // 12)
        small_h = max(1, h // 12)
        small = cv2.resize(roi, (small_w, small_h), interpolation=cv2.INTER_LINEAR)
        image[y:y2, x:x2] = cv2.resize(small, (x2 - x, y2 - y), interpolation=cv2.INTER_NEAREST)
        return

    kernel = max(31, (min(w, h) // 2) | 1)
    blurred = cv2.GaussianBlur(roi, (kernel, kernel), 0)
    image[y:y2, x:x2] = blurred


def _detect_text_like_regions(image: np.ndarray):
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.bilateralFilter(gray, 7, 50, 50)
    binary = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        31,
        12,
    )

    horizontal = cv2.getStructuringElement(cv2.MORPH_RECT, (max(18, w // 40), 3))
    merged = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, horizontal, iterations=2)
    contours, _ = cv2.findContours(merged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    boxes = []
    min_area = max(80, int(w * h * 0.00015))
    max_area = int(w * h * 0.20)
    for contour in contours:
        x, y, bw, bh = cv2.boundingRect(contour)
        area = bw * bh
        if area < min_area or area > max_area:
            continue
        if bw < w * 0.08 or bh < 8:
            continue
        if bh > h * 0.25:
            continue
        pad_x = max(6, int(bw * 0.04))
        pad_y = max(4, int(bh * 0.35))
        boxes.append((
            max(0, x - pad_x),
            max(0, y - pad_y),
            min(w - x, bw + pad_x * 2),
            min(h - y, bh + pad_y * 2),
        ))

    boxes = sorted(boxes, key=lambda item: (item[1], item[0]))
    deduped = []
    for box in boxes:
        bx, by, bw, bh = box
        duplicate = False
        for old in deduped:
            ox, oy, ow, oh = old
            ix1, iy1 = max(bx, ox), max(by, oy)
            ix2, iy2 = min(bx + bw, ox + ow), min(by + bh, oy + oh)
            if ix2 > ix1 and iy2 > iy1:
                overlap = (ix2 - ix1) * (iy2 - iy1)
                if overlap / max(1, min(bw * bh, ow * oh)) > 0.55:
                    duplicate = True
                    break
        if not duplicate:
            deduped.append(box)
    return deduped[:24]


def redact_image(image: Image.Image, mode="blur"):
    bgr = _pil_to_bgr(image)
    boxes = _detect_text_like_regions(bgr)
    redacted = bgr.copy()
    for box in boxes:
        _blur_region(redacted, box, mode)
    return _bgr_to_pil(redacted), boxes


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "engine": "opencv_text_region_redactor",
    }


@app.post("/api/redact-document")
async def redact_document(payload: RedactDocumentRequest):
    try:
        image, mime = _decode_data_url(payload.image)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not decode image: {exc}") from exc

    redacted, boxes = redact_image(image, payload.mode)
    return {
        "engine": "opencv_text_region_redactor",
        "mode": payload.mode,
        "sensitive_count": len(boxes),
        "redacted_count": len(boxes),
        "redacted_image": _data_url_from_image(redacted, mime if mime in {"image/png", "image/jpeg"} else "image/png"),
    }


@app.post("/redact-image")
async def redact_image_upload(file: UploadFile = File(...), mode: str = "blur"):
    raw = await file.read()
    try:
      image = Image.open(io.BytesIO(raw))
      image = ImageOps.exif_transpose(image).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not decode image: {exc}") from exc
    redacted, boxes = redact_image(image, mode)
    output = io.BytesIO()
    redacted.save(output, format="PNG")
    return Response(
        content=output.getvalue(),
        media_type="image/png",
        headers={
            "X-Engine-Used": "opencv_text_region_redactor",
            "X-Sensitive-Count": str(len(boxes)),
            "X-Redacted-Count": str(len(boxes)),
        },
    )
