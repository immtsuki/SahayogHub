#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import sys
import time
import uuid
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple

import cv2
import easyocr
import numpy as np
import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

try:
    from ultralytics import YOLO
except Exception:
    YOLO = None


# ============================================================
# FAST CONFIG
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", BASE_DIR / "api_output"))
UPLOAD_DIR = OUTPUT_DIR / "uploads"
REDACTED_DIR = OUTPUT_DIR / "redacted"
JSON_DIR = OUTPUT_DIR / "json"

for d in (OUTPUT_DIR, UPLOAD_DIR, REDACTED_DIR, JSON_DIR):
    d.mkdir(parents=True, exist_ok=True)

MODEL_CANDIDATES = [
    Path(os.getenv("MODEL_PATH")) if os.getenv("MODEL_PATH") else None,
    BASE_DIR / "ai" / "best.pt",
    BASE_DIR / "best.pt",
    BASE_DIR / "models" / "sensitive_fields.pt",
    BASE_DIR / "runs" / "detect" / "ai_runs" / "sensitive_blur" / "weights" / "best.pt",
]

MODEL_PATH: Optional[Path] = None
for p in MODEL_CANDIDATES:
    if p and p.exists():
        MODEL_PATH = p
        break

CUDA_AVAILABLE = torch.cuda.is_available()
REQUESTED_DEVICE = os.getenv("DEVICE", "cuda:0" if CUDA_AVAILABLE else "cpu").lower().strip()

if not CUDA_AVAILABLE or REQUESTED_DEVICE in {"cpu", "-1", "none"}:
    DEVICE = "cpu"
    YOLO_DEVICE: int | str = "cpu"
    USE_GPU = False
else:
    if REQUESTED_DEVICE in {"0", "cuda", "cuda:0"}:
        DEVICE = "cuda:0"
        YOLO_DEVICE = 0
    elif REQUESTED_DEVICE.startswith("cuda:"):
        DEVICE = REQUESTED_DEVICE
        YOLO_DEVICE = int(REQUESTED_DEVICE.split(":", 1)[1])
    else:
        DEVICE = "cuda:0"
        YOLO_DEVICE = 0
    USE_GPU = True

EASYOCR_GPU = os.getenv("EASYOCR_GPU", "1") == "1" and USE_GPU
OCR_LANGS = [x.strip() for x in os.getenv("OCR_LANGS", "en").split(",") if x.strip()]

CPU_THREADS = int(os.getenv("CPU_THREADS", "8"))
torch.set_num_threads(min(CPU_THREADS, os.cpu_count() or CPU_THREADS))
cv2.setNumThreads(0)

if USE_GPU:
    torch.backends.cudnn.benchmark = True
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True

DEFAULT_YOLO_CONF = float(os.getenv("YOLO_CONF", "0.15"))
DEFAULT_IMGSZ = int(os.getenv("IMGSZ", "640"))
OCR_CONFIDENCE = float(os.getenv("OCR_CONFIDENCE", "0.25"))
OCR_MAX_SIDE_FAST = int(os.getenv("OCR_MAX_SIDE_FAST", "1280"))
OCR_MAX_SIDE_BALANCED = int(os.getenv("OCR_MAX_SIDE_BALANCED", "1600"))
OCR_BATCH_GPU = int(os.getenv("OCR_BATCH_GPU", "8"))
BLUR_KERNEL = int(os.getenv("BLUR_KERNEL", "71"))
PADDING = int(os.getenv("PADDING", "8"))
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


# ============================================================
# REGEX / LABELS
# ============================================================

D = r"0-9०-९"
NEPALI_DIGIT_TABLE = str.maketrans("०१२३४५६७८९", "0123456789")

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
URL_RE = re.compile(r"\b(?:https?://|www\.)[^\s,;]+", re.I)
NEPAL_PHONE_RE = re.compile(rf"(?<![{D}])(?:\+?(?:977|९७७)[\s\-]?)?[9९][78७८][{D}]{{8}}(?![{D}])")
PHONE_RE = re.compile(rf"(?<![\w{D}])(?:\+?[{D}][{D}\s().\-]{{7,}}[{D}])(?![\w{D}])")
DATE_RE = re.compile(rf"(?<![{D}])(?:[{D}]{{4}}[-/.][{D}]{{1,2}}[-/.][{D}]{{1,2}}|[{D}]{{1,2}}[-/.][{D}]{{1,2}}[-/.][{D}]{{2,4}})(?![{D}])")
DASHED_ID_RE = re.compile(rf"(?<![{D}])(?:[{D}]{{1,4}}\s*[-/]\s*){{1,5}}[{D}]{{2,10}}(?![{D}])")
LONG_NUMBER_RE = re.compile(rf"(?<![{D}])[{D}]{{6,18}}(?![{D}])")
DL_RE = re.compile(rf"(?<![{D}])[{D}]{{2}}\s*[-/]\s*[{D}]{{2}}\s*[-/]\s*[{D}]{{5,10}}(?![{D}])")
PASSPORT_RE = re.compile(rf"\b[A-Z][A-Z0-9]?\s*[-/]?\s*[{D}]{{6,9}}\b", re.I)

LABEL_RE = re.compile(
    r"("
    r"ना\.?\s*प्र\.?\s*नं\.?|नागरिकता\s*(?:नं|नम्बर|प्रमाणपत्र)?|"
    r"नाम\s*थर|नाम|जन्म\s*स्थान|जन्मस्थान|जन्म\s*मिति|जन्ममिति|"
    r"बाबु|बुवा|आमा|पति|पत्नी|बाजे|"
    r"स्थायी\s*वासस्थान|स्थायी|अस्थायी|ठेगाना|"
    r"जिल्ला|गा\.?\s*पा\.?|गाउँपालिका|नगरपालिका|न\.?\s*पा\.?|वडा\s*(?:नं|नम्बर)?|"
    r"लिङ्ग|लिंग|फोन|मोबाइल|सम्पर्क|"
    r"d\.?\s*l\.?\s*no\.?|d\.?\s*o\.?\s*b\.?|d\.?\s*o\.?\s*i\.?|d\.?\s*o\.?\s*e\.?|"
    r"b\.?\s*g\.?|blood\s*group|"
    r"name|full\s*name|f\s*/?\s*h\s*name|father'?s?\s*name|mother'?s?\s*name|"
    r"address|permanent\s*address|temporary\s*address|"
    r"date\s*of\s*birth|birth\s*date|birth\s*place|"
    r"phone\s*(?:no|num|number)?|mobile\s*(?:no|num|number)?|contact|"
    r"citizenship\s*(?:no|num|number)?|national\s*id|passport\s*(?:no|num|number)?|"
    r"driver'?s?\s*licen[cs]e|driving\s*licen[cs]e|license\s*(?:no|num|number)?"
    r")",
    re.I,
)

SAFE_LABEL_RE = re.compile(
    r"^(?:government(?:\s+of\s+nepal)?|nepal\s+government|driving\s+licen[cs]e|"
    r"issued\s+by|signature\s+of\s+holder|category|"
    r"नेपाल\s*सरकार|गृह\s*मन्त्रालय|जिल्ला\s*प्रशासन\s*कार्यालय|"
    r"नेपाली\s*नागरिकताको\s*प्रमाणपत्र|"
    r"name|address|dob|doi|doe|d\.?\s*l\.?\s*no\.?|b\.?\s*g\.?|"
    r"नाम|नाम\s*थर|ठेगाना|जिल्ला|वडा|लिङ्ग|लिंग|फोन|मोबाइल)\s*[:：.\-/]*$",
    re.I,
)

DOCUMENT_HINT_RE = re.compile(
    r"(नागरिकता|प्रमाणपत्र|राहदानी|सवारी\s*चालक|जिल्ला\s*प्रशासन|"
    r"citizenship|passport|license|licence|national\s*id|government\s*of\s*nepal|driving\s*licen[cs]e)",
    re.I,
)

DEFAULT_YOLO_REDACT_CLASSES = {
    "sensitive_text", "sensitive", "pii", "id_field_value", "visible_id_text",
    "citizenship_no", "citizenship_number", "national_id_no", "license_no",
    "drivers_license_number", "passport_no", "passport_number", "phone_no",
    "phone_number", "dob", "date_of_birth", "issue_date", "date_of_issue",
    "expiry_date", "date_of_expiry", "name", "person_name", "father_name",
    "mother_name", "address", "blood_group", "signature", "qr",
}
PHOTO_CLASSES = {"photo", "face", "portrait"}


# ============================================================
# BASIC HELPERS
# ============================================================

def normalize_text(text: str) -> str:
    text = str(text or "")
    text = text.replace("|", "I").replace("–", "-").replace("—", "-").replace("：", ":").replace("।", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def ascii_digits(text: str) -> str:
    return str(text or "").translate(NEPALI_DIGIT_TABLE)


def clean_value(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    value = normalize_text(value)
    value = re.sub(r"^[\s:;,./()\-]+", "", value)
    value = re.sub(r"[\s:;,./()\-]+$", "", value)
    return value or None


def make_kernel_odd(value: int) -> int:
    value = int(value)
    if value % 2 == 0:
        value += 1
    return max(3, value)


def decode_upload(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode uploaded image. Use jpg/png/webp/bmp/tif.")
    return image


def save_image(path: Path, image: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    ok = cv2.imwrite(str(path), image)
    if not ok:
        raise RuntimeError(f"Could not save image: {path}")


def clamp_bbox(box: List[int] | Tuple[int, int, int, int], image_shape) -> List[int]:
    h, w = image_shape[:2]
    x1, y1, x2, y2 = [int(round(float(v))) for v in box]
    x1 = max(0, min(w, x1))
    y1 = max(0, min(h, y1))
    x2 = max(0, min(w, x2))
    y2 = max(0, min(h, y2))
    return [x1, y1, x2, y2]


def expand_bbox(box: List[int], image_shape, pad: int = PADDING) -> List[int]:
    x1, y1, x2, y2 = box
    return clamp_bbox([x1 - pad, y1 - pad, x2 + pad, y2 + pad], image_shape)


def bbox_area(box: List[int]) -> int:
    x1, y1, x2, y2 = box
    return max(0, x2 - x1) * max(0, y2 - y1)


def bbox_iou(a: List[int], b: List[int]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = bbox_area([ix1, iy1, ix2, iy2])
    union = bbox_area(a) + bbox_area(b) - inter
    return 0.0 if union <= 0 else inter / union


def dedupe_detections(detections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for det in sorted(detections, key=lambda d: -float(d.get("confidence") or 0)):
        box = det["box"]
        text = normalize_text(det.get("text") or det.get("value") or "")
        duplicate = False
        for old in out:
            if bbox_iou(box, old["box"]) > 0.78:
                duplicate = True
                break
            old_text = normalize_text(old.get("text") or old.get("value") or "")
            if text and old_text and text == old_text:
                duplicate = True
                break
        if not duplicate:
            out.append(det)
    return sorted(out, key=lambda d: (d["box"][1], d["box"][0]))


def redact_region(image: np.ndarray, box: List[int], mode: str = "blur") -> None:
    x1, y1, x2, y2 = clamp_bbox(box, image.shape)
    if x2 <= x1 or y2 <= y1:
        return
    roi = image[y1:y2, x1:x2]
    if roi.size == 0:
        return

    h, w = roi.shape[:2]

    if mode == "black":
        image[y1:y2, x1:x2] = 0
        return

    if mode == "pixelate":
        block = 22
        small = cv2.resize(roi, (max(1, w // block), max(1, h // block)), interpolation=cv2.INTER_LINEAR)
        image[y1:y2, x1:x2] = cv2.resize(small, (w, h), interpolation=cv2.INTER_NEAREST)
        return

    kernel = make_kernel_odd(max(BLUR_KERNEL, min(151, int(min(h, w) * 1.2))))
    blurred = cv2.GaussianBlur(roi, (kernel, kernel), 0)
    blurred = cv2.GaussianBlur(blurred, (kernel, kernel), 0)

    small_w = max(1, w // 18)
    small_h = max(1, h // 18)
    mosaic = cv2.resize(blurred, (small_w, small_h), interpolation=cv2.INTER_LINEAR)
    mosaic = cv2.resize(mosaic, (w, h), interpolation=cv2.INTER_NEAREST)
    image[y1:y2, x1:x2] = mosaic


def bbox_from_easyocr(points, scale_back: float = 1.0) -> List[int]:
    xs = [float(p[0]) for p in points]
    ys = [float(p[1]) for p in points]
    box = [min(xs), min(ys), max(xs), max(ys)]
    if scale_back != 1.0:
        box = [v * scale_back for v in box]
    return [int(round(v)) for v in box]


def resize_for_ocr(image: np.ndarray, max_side: int) -> Tuple[np.ndarray, float]:
    h, w = image.shape[:2]
    side = max(h, w)
    if side <= max_side:
        return image, 1.0
    scale = max_side / float(side)
    resized = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return resized, scale


def rotate_image(image: np.ndarray, angle: int) -> np.ndarray:
    if angle == 90:
        return cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
    if angle == 180:
        return cv2.rotate(image, cv2.ROTATE_180)
    if angle == 270:
        return cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return image


# ============================================================
# OCR
# ============================================================

def run_ocr_once(reader: easyocr.Reader, image: np.ndarray, *, ocr_max_side: int) -> List[Dict[str, Any]]:
    ocr_image, scale = resize_for_ocr(image, max_side=ocr_max_side)
    scale_back = 1.0 / scale
    rgb = cv2.cvtColor(ocr_image, cv2.COLOR_BGR2RGB)

    raw = reader.readtext(
        rgb,
        detail=1,
        paragraph=False,
        decoder="greedy",
        batch_size=OCR_BATCH_GPU if EASYOCR_GPU else 1,
        workers=0,
        canvas_size=ocr_max_side,
        mag_ratio=1.0,
        text_threshold=0.45,
        low_text=0.25,
        link_threshold=0.35,
        width_ths=0.80,
    )

    items: List[Dict[str, Any]] = []
    for points, text, conf in raw:
        conf = float(conf)
        if conf < OCR_CONFIDENCE:
            continue
        text = normalize_text(text)
        if not text:
            continue
        box = bbox_from_easyocr(points, scale_back=scale_back)
        box = clamp_bbox(box, image.shape)
        if bbox_area(box) <= 4:
            continue
        x1, y1, x2, y2 = box
        items.append({
            "text": text,
            "confidence": round(conf, 4),
            "box": box,
            "x1": x1, "y1": y1, "x2": x2, "y2": y2,
            "cx": (x1 + x2) / 2,
            "cy": (y1 + y2) / 2,
        })
    return items


def choose_best_orientation(reader: easyocr.Reader, image: np.ndarray, rotation_ocr: bool, *, ocr_max_side: int) -> Tuple[np.ndarray, int, List[Dict[str, Any]]]:
    if not rotation_ocr:
        return image, 0, run_ocr_once(reader, image, ocr_max_side=ocr_max_side)

    best_score = -1.0
    best_angle = 0
    best_image = image
    best_items: List[Dict[str, Any]] = []
    for angle in (0, 90, 180, 270):
        rotated = rotate_image(image, angle)
        items = run_ocr_once(reader, rotated, ocr_max_side=ocr_max_side)
        score = sum(len(i["text"]) * float(i["confidence"]) for i in items)
        if score > best_score:
            best_score = score
            best_angle = angle
            best_image = rotated
            best_items = items
    return best_image, best_angle, best_items


def group_ocr_lines(ocr_items: List[Dict[str, Any]], image_height: int) -> List[Dict[str, Any]]:
    tolerance = max(10, int(image_height * 0.018))
    groups: List[Dict[str, Any]] = []

    for item in sorted(ocr_items, key=lambda x: (x["cy"], x["x1"])):
        placed = False
        for group in groups:
            if abs(group["cy"] - item["cy"]) <= tolerance:
                group["items"].append(item)
                group["cy"] = sum(i["cy"] for i in group["items"]) / len(group["items"])
                placed = True
                break
        if not placed:
            groups.append({"cy": item["cy"], "items": [item]})

    lines: List[Dict[str, Any]] = []
    for group in groups:
        items = sorted(group["items"], key=lambda x: x["x1"])
        parts: List[str] = []
        spans: List[Tuple[int, int, List[int]]] = []
        pos = 0
        for item in items:
            if parts:
                parts.append(" ")
                pos += 1
            txt = normalize_text(item["text"])
            start = pos
            parts.append(txt)
            pos += len(txt)
            spans.append((start, pos, item["box"]))
        text = normalize_text("".join(parts))
        box = [
            min(i["x1"] for i in items),
            min(i["y1"] for i in items),
            max(i["x2"] for i in items),
            max(i["y2"] for i in items),
        ]
        conf = sum(float(i["confidence"]) for i in items) / max(1, len(items))
        lines.append({"text": text, "box": box, "items": items, "spans": spans, "confidence": round(conf, 4)})
    return lines


def bbox_for_span(full_text: str, span: Tuple[int, int], line_box: List[int], spans: List[Tuple[int, int, List[int]]]) -> List[int]:
    start, end = span
    start = max(0, min(len(full_text), start))
    end = max(start + 1, min(len(full_text), end))

    boxes: List[List[int]] = []
    for ts, te, tb in spans:
        if start >= te or end <= ts:
            continue
        token_len = max(1, te - ts)
        tx1, ty1, tx2, ty2 = tb
        local_start = max(0, start - ts) / token_len
        local_end = min(token_len, end - ts) / token_len
        sx1 = int(round(tx1 + (tx2 - tx1) * local_start))
        sx2 = int(round(tx1 + (tx2 - tx1) * local_end))
        if sx2 - sx1 < 5:
            sx2 = min(tx2, sx1 + 5)
        boxes.append([sx1, ty1, sx2, ty2])

    if boxes:
        return [min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)]

    x1, y1, x2, y2 = line_box
    n = max(1, len(full_text))
    sx1 = int(round(x1 + (x2 - x1) * (start / n)))
    sx2 = int(round(x1 + (x2 - x1) * (end / n)))
    if sx2 - sx1 < 5:
        sx2 = min(x2, sx1 + 5)
    return [sx1, y1, sx2, y2]


# ============================================================
# EXTRACTION + OCR DETECTION
# ============================================================

def add_detection(dets: List[Dict[str, Any]], *, category: str, text: str, box: List[int], reason: str, confidence: Optional[float] = None) -> None:
    text = clean_value(text)
    if not text:
        return
    dets.append({
        "source": "ocr",
        "category": category,
        "text": text,
        "confidence": None if confidence is None else round(float(confidence), 4),
        "box": [int(v) for v in box],
        "reason": [reason],
        "redacted": True,
    })


def extract_fields(lines: List[str]) -> Dict[str, Any]:
    raw_text = "\n".join(lines)
    data: Dict[str, Any] = {
        "name": None,
        "citizenshipNumber": None,
        "drivingLicenseNumber": None,
        "phoneNumber": None,
        "dateOfBirth": None,
        "address": None,
        "email": None,
        "passportNumber": None,
        "issueDate": None,
        "expiryDate": None,
        "otherNumbers": [],
        "rawText": raw_text,
    }

    for line in lines:
        line = normalize_text(line)
        lower = line.lower()

        if data["email"] is None:
            m = EMAIL_RE.search(line)
            if m:
                data["email"] = m.group(0)

        if data["phoneNumber"] is None:
            m = NEPAL_PHONE_RE.search(line) or PHONE_RE.search(line)
            if m:
                data["phoneNumber"] = clean_value(m.group(0))

        if data["drivingLicenseNumber"] is None and ("license" in lower or "licence" in lower or "d.l" in lower or "dl" in lower):
            m = DL_RE.search(line) or DASHED_ID_RE.search(line) or LONG_NUMBER_RE.search(line)
            if m:
                data["drivingLicenseNumber"] = clean_value(m.group(0))

        if data["citizenshipNumber"] is None and ("citizen" in lower or "नागरिक" in line or "ना" in line):
            m = DASHED_ID_RE.search(line) or LONG_NUMBER_RE.search(line)
            if m:
                data["citizenshipNumber"] = clean_value(m.group(0))

        if data["passportNumber"] is None and ("passport" in lower or "राहदानी" in line):
            m = PASSPORT_RE.search(line) or LONG_NUMBER_RE.search(line)
            if m:
                data["passportNumber"] = clean_value(m.group(0))

        if data["dateOfBirth"] is None and ("dob" in lower or "birth" in lower or "जन्म" in line):
            m = DATE_RE.search(line)
            if m:
                data["dateOfBirth"] = m.group(0)

        if data["issueDate"] is None and ("doi" in lower or "issue" in lower or "जारी" in line):
            m = DATE_RE.search(line)
            if m:
                data["issueDate"] = m.group(0)

        if data["expiryDate"] is None and ("doe" in lower or "expiry" in lower or "expire" in lower or "म्याद" in line):
            m = DATE_RE.search(line)
            if m:
                data["expiryDate"] = m.group(0)

        if data["name"] is None:
            m = re.search(r"\bname\b\s*[:.\-]?\s*([A-Za-z][A-Za-z\s.'\-]{2,80})", line, re.I)
            if m and "father" not in lower and "mother" not in lower and "f/h" not in lower:
                data["name"] = clean_value(m.group(1))

        if data["address"] is None:
            m = re.search(r"\baddress\b\s*[:.\-]?\s*(.+)", line, re.I)
            if m:
                data["address"] = clean_value(m.group(1))

    used = {str(v) for k, v in data.items() if k != "otherNumbers" and v}
    other: List[str] = []
    for m in list(DASHED_ID_RE.finditer(raw_text)) + list(LONG_NUMBER_RE.finditer(raw_text)):
        val = clean_value(m.group(0))
        if not val or val in used:
            continue
        if DATE_RE.fullmatch(val):
            continue
        if val not in other:
            other.append(val)
    data["otherNumbers"] = other
    return data


def get_ocr_detections(lines: List[Dict[str, Any]], *, id_document: bool) -> List[Dict[str, Any]]:
    dets: List[Dict[str, Any]] = []

    pattern_specs = [
        (EMAIL_RE, "email", "email pattern"),
        (URL_RE, "url", "url pattern"),
        (NEPAL_PHONE_RE, "phone_number", "Nepal phone pattern"),
        (DL_RE, "drivers_license_number", "driving license number pattern"),
        (PASSPORT_RE, "passport_number", "passport number pattern"),
        (DASHED_ID_RE, "possible_identifier", "dashed ID-like number"),
    ]

    for line in lines:
        text = line["text"]
        box = line["box"]
        spans = line["spans"]
        conf = line.get("confidence")
        lower = text.lower()

        # Pattern-level redaction. This is faster and avoids blurring full lines.
        for regex, category, reason in pattern_specs:
            for m in regex.finditer(text):
                if category == "possible_identifier" and not id_document:
                    continue
                add_detection(
                    dets,
                    category=category,
                    text=m.group(0),
                    box=bbox_for_span(text, m.span(), box, spans),
                    reason=reason,
                    confidence=conf,
                )

        for m in PHONE_RE.finditer(text):
            digits = re.sub(r"\D", "", ascii_digits(m.group(0)))
            if 8 <= len(digits) <= 15:
                add_detection(dets, category="phone_number", text=m.group(0), box=bbox_for_span(text, m.span(), box, spans), reason="phone-like pattern", confidence=conf)

        for m in DATE_RE.finditer(text):
            if id_document or any(x in lower for x in ("dob", "birth", "doi", "issue", "doe", "expiry", "expire")) or any(x in text for x in ("जन्म", "जारी", "म्याद")):
                add_detection(dets, category="date", text=m.group(0), box=bbox_for_span(text, m.span(), box, spans), reason="date in ID context", confidence=conf)

        # Full ID-field value redaction: blur value after labels, keep label visible when possible.
        label_matches = list(LABEL_RE.finditer(text))
        if label_matches and id_document:
            for idx, m in enumerate(label_matches):
                start = m.end()
                while start < len(text) and text[start] in " \t:-–—;,./()।":
                    start += 1
                end = label_matches[idx + 1].start() if idx + 1 < len(label_matches) else len(text)
                while end > start and text[end - 1] in " \t:-–—;,./()।":
                    end -= 1
                if end <= start:
                    continue
                value = clean_value(text[start:end])
                if not value or SAFE_LABEL_RE.fullmatch(value):
                    continue
                if not re.search(rf"[A-Za-z\u0900-\u097F{D}]", value):
                    continue
                add_detection(
                    dets,
                    category="id_field_value",
                    text=value,
                    box=bbox_for_span(text, (start, end), box, spans),
                    reason="value after sensitive ID label",
                    confidence=conf,
                )

    return dets


# ============================================================
# YOLO
# ============================================================

def get_yolo_detections(
    model: Any,
    image: np.ndarray,
    conf: float,
    imgsz: int,
    redact_photo: bool,
    lock: threading.RLock,
) -> List[Dict[str, Any]]:
    detections: List[Dict[str, Any]] = []
    if model is None:
        return detections

    with lock:
        with torch.inference_mode():
            result = model.predict(
                source=image,
                conf=conf,
                imgsz=imgsz,
                device=YOLO_DEVICE,
                half=USE_GPU,
                verbose=False,
            )[0]

    names = result.names if hasattr(result, "names") else model.names
    class_count = len(names) if hasattr(names, "__len__") else 1
    if result.boxes is None:
        return detections

    for b in result.boxes:
        cls_id = int(b.cls[0])
        category = str(names.get(cls_id, cls_id)) if isinstance(names, dict) else str(cls_id)
        score = float(b.conf[0])
        bbox = clamp_bbox(b.xyxy[0].detach().cpu().numpy().tolist(), image.shape)

        should_redact = class_count == 1 or category in DEFAULT_YOLO_REDACT_CLASSES or (redact_photo and category in PHOTO_CLASSES)
        detections.append({
            "source": "yolo",
            "category": category,
            "text": None,
            "confidence": round(score, 4),
            "box": bbox,
            "reason": ["yolo_detection"],
            "redacted": should_redact,
        })

    return detections


# ============================================================
# MAIN PROCESSING
# ============================================================

def process_image_fast(
    image: np.ndarray,
    *,
    reader: Optional[easyocr.Reader],
    yolo_model: Any,
    yolo_lock: threading.RLock,
    ocr_lock: threading.RLock,
    engine: Literal["hybrid", "yolo", "ocr"],
    mode: Literal["blur", "black", "pixelate"],
    conf: float,
    imgsz: int,
    redact_photo: bool,
    rotation_ocr: bool,
    ocr_passes: Literal["fast", "balanced"],
) -> Dict[str, Any]:
    working_image = image.copy()
    rotation_applied = 0

    ocr_items: List[Dict[str, Any]] = []
    ocr_lines: List[Dict[str, Any]] = []
    line_texts: List[str] = []
    extracted_data: Dict[str, Any] = {
        "name": None,
        "citizenshipNumber": None,
        "drivingLicenseNumber": None,
        "phoneNumber": None,
        "dateOfBirth": None,
        "address": None,
        "email": None,
        "passportNumber": None,
        "issueDate": None,
        "expiryDate": None,
        "otherNumbers": [],
        "rawText": "",
    }

    yolo_detections: List[Dict[str, Any]] = []
    ocr_detections: List[Dict[str, Any]] = []
    id_document = False

    if engine in {"hybrid", "ocr"}:
        if reader is None:
            raise RuntimeError("OCR reader is not loaded.")
        ocr_max_side = OCR_MAX_SIDE_FAST if ocr_passes == "fast" else OCR_MAX_SIDE_BALANCED
        with ocr_lock:
            working_image, rotation_applied, ocr_items = choose_best_orientation(
                reader,
                working_image,
                rotation_ocr=rotation_ocr,
                ocr_max_side=ocr_max_side,
            )
        h, _ = working_image.shape[:2]
        ocr_lines = group_ocr_lines(ocr_items, h)
        line_texts = [line["text"] for line in ocr_lines]
        raw_text = "\n".join(line_texts)
        id_document = bool(DOCUMENT_HINT_RE.search(raw_text))
        extracted_data = extract_fields(line_texts)
        ocr_detections = get_ocr_detections(ocr_lines, id_document=id_document)

    if engine in {"hybrid", "yolo"}:
        yolo_detections = get_yolo_detections(
            yolo_model,
            working_image,
            conf=conf,
            imgsz=imgsz,
            redact_photo=redact_photo,
            lock=yolo_lock,
        )

    all_detections = dedupe_detections(yolo_detections + ocr_detections)
    redacted_image = working_image.copy()

    for det in all_detections:
        if not det.get("redacted", True):
            continue
        box = expand_bbox(det["box"], redacted_image.shape, pad=PADDING)
        redact_region(redacted_image, box, mode=mode)

    return {
        "redactedImage": redacted_image,
        "rotationApplied": rotation_applied,
        "idDocumentInferred": id_document,
        "extractedData": extracted_data,
        "ocrLines": line_texts,
        "ocrItems": ocr_items,
        "sensitiveDetections": all_detections,
        "sensitiveCount": len(all_detections),
        "redactedCount": sum(1 for d in all_detections if d.get("redacted", True)),
    }


# ============================================================
# FASTAPI APP
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("==========================================")
    print("FAST GPU DOCUMENT REDACTOR STARTING")
    print(f"PYTHON: {sys.executable}")
    print(f"BASE_DIR: {BASE_DIR}")
    print(f"OUTPUT_DIR: {OUTPUT_DIR}")
    print(f"MODEL_PATH: {MODEL_PATH}")
    print(f"TORCH: {torch.__version__}")
    print(f"TORCH CUDA: {torch.version.cuda}")
    print(f"CUDA_AVAILABLE: {CUDA_AVAILABLE}")
    print(f"DEVICE: {DEVICE}")
    print(f"YOLO_DEVICE: {YOLO_DEVICE}")
    print(f"USE_GPU: {USE_GPU}")
    if CUDA_AVAILABLE:
        print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"OCR_LANGS: {OCR_LANGS}")
    print(f"EASYOCR_GPU: {EASYOCR_GPU}")
    print("==========================================")

    app.state.reader = None  # Lazy-load OCR only when needed.
    app.state.ocr_lock = threading.RLock()
    app.state.yolo_lock = threading.RLock()
    app.state.yolo_model = None

    if YOLO is not None and MODEL_PATH is not None and MODEL_PATH.exists():
        print(f"Loading YOLO: {MODEL_PATH}")
        app.state.yolo_model = YOLO(str(MODEL_PATH))
        if USE_GPU:
            app.state.yolo_model.to(YOLO_DEVICE)
        try:
            app.state.yolo_model.fuse()
        except Exception:
            pass
        try:
            dummy = np.zeros((DEFAULT_IMGSZ, DEFAULT_IMGSZ, 3), dtype=np.uint8)
            app.state.yolo_model.predict(
                source=dummy,
                conf=DEFAULT_YOLO_CONF,
                imgsz=DEFAULT_IMGSZ,
                device=YOLO_DEVICE,
                half=USE_GPU,
                verbose=False,
            )
            print("YOLO warmup complete.")
        except Exception as exc:
            print(f"YOLO warmup skipped: {exc}")
        print("YOLO loaded.")
    else:
        print("YOLO not loaded. Put best.pt in .\\ai\\best.pt or set MODEL_PATH.")

    yield


app = FastAPI(title="Fast YOLO + EasyOCR Sensitive Data Redactor", lifespan=lifespan)
app.mount("/files", StaticFiles(directory=str(OUTPUT_DIR)), name="files")


def get_reader() -> easyocr.Reader:
    if app.state.reader is None:
        with app.state.ocr_lock:
            if app.state.reader is None:
                print(f"Loading EasyOCR: languages={OCR_LANGS}, gpu={EASYOCR_GPU}")
                app.state.reader = easyocr.Reader(OCR_LANGS, gpu=EASYOCR_GPU)
                print("EasyOCR device:", getattr(app.state.reader, "device", "unknown"))
    return app.state.reader


def resolve_engine(engine: Literal["auto", "hybrid", "yolo", "ocr"]) -> Literal["hybrid", "yolo", "ocr"]:
    if engine == "auto":
        return "hybrid" if app.state.yolo_model is not None else "ocr"
    if engine == "yolo" and app.state.yolo_model is None:
        raise HTTPException(status_code=503, detail="YOLO model not loaded. Put best.pt in .\\ai\\best.pt or set MODEL_PATH.")
    if engine == "hybrid" and app.state.yolo_model is None:
        return "ocr"
    return engine


@app.get("/", response_class=HTMLResponse)
def index():
    return """
    <!doctype html>
    <html>
    <head><title>Fast GPU Redactor</title></head>
    <body style="font-family:Arial;max-width:900px;margin:40px auto;line-height:1.5">
      <h1>Fast GPU YOLO + OCR Redactor</h1>
      <form action="/process?engine=auto&mode=blur&ocr_passes=fast" method="post" enctype="multipart/form-data">
        <input type="file" name="file" accept="image/*" required>
        <button type="submit">Process</button>
      </form>
      <p><b>Fastest blur only:</b> <code>/redact-image?engine=yolo</code></p>
      <p><b>Extract + blur:</b> <code>/process?engine=hybrid</code></p>
      <p><b>Health:</b> <a href="/health">/health</a></p>
    </body>
    </html>
    """


@app.get("/health")
def health():
    return {
        "ok": True,
        "python": sys.executable,
        "torch": torch.__version__,
        "torchCuda": torch.version.cuda,
        "cudaAvailable": CUDA_AVAILABLE,
        "gpuName": torch.cuda.get_device_name(0) if CUDA_AVAILABLE else None,
        "device": DEVICE,
        "yoloDevice": YOLO_DEVICE,
        "useGpu": USE_GPU,
        "easyocrGpu": EASYOCR_GPU,
        "ocrLangs": OCR_LANGS,
        "ocrLoaded": app.state.reader is not None,
        "modelPath": str(MODEL_PATH) if MODEL_PATH else None,
        "yoloLoaded": app.state.yolo_model is not None,
        "outputDir": str(OUTPUT_DIR),
    }


async def _process_common(
    file: UploadFile,
    *,
    engine: Literal["auto", "hybrid", "yolo", "ocr"],
    mode: Literal["blur", "black", "pixelate"],
    conf: float,
    imgsz: int,
    redact_photo: bool,
    rotation_ocr: bool,
    ocr_passes: Literal["fast", "balanced"],
    save_outputs: bool,
) -> Dict[str, Any]:
    raw = await file.read()
    try:
        image = decode_upload(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    actual_engine = resolve_engine(engine)
    reader = get_reader() if actual_engine in {"hybrid", "ocr"} else None

    result = await run_in_threadpool(
        process_image_fast,
        image,
        reader=reader,
        yolo_model=app.state.yolo_model,
        yolo_lock=app.state.yolo_lock,
        ocr_lock=app.state.ocr_lock,
        engine=actual_engine,
        mode=mode,
        conf=conf,
        imgsz=imgsz,
        redact_photo=redact_photo,
        rotation_ocr=rotation_ocr,
        ocr_passes=ocr_passes,
    )

    redacted_image = result.pop("redactedImage")

    payload: Dict[str, Any] = {
        "engineRequested": engine,
        "engineUsed": actual_engine,
        "mode": mode,
        "device": DEVICE,
        "gpu": USE_GPU,
        "yoloLoaded": app.state.yolo_model is not None,
        "easyocrGpu": EASYOCR_GPU,
        "inputFile": file.filename,
        **result,
    }

    if save_outputs:
        suffix = Path(file.filename or "upload.png").suffix.lower()
        if suffix not in IMAGE_EXTS:
            suffix = ".png"
        stem = Path(file.filename or "upload").stem
        safe_stem = re.sub(r"[^A-Za-z0-9_.-]+", "_", stem)[:80]
        file_id = f"{int(time.time() * 1000)}_{uuid.uuid4().hex[:8]}_{safe_stem}"

        upload_path = UPLOAD_DIR / f"{file_id}{suffix}"
        redacted_path = REDACTED_DIR / f"{file_id}.redacted.png"
        json_path = JSON_DIR / f"{file_id}.json"

        save_image(upload_path, image)
        save_image(redacted_path, redacted_image)

        payload.update({
            "savedUpload": str(upload_path),
            "savedRedactedImage": str(redacted_path),
            "savedJson": str(json_path),
            "redactedUrl": f"/files/redacted/{redacted_path.name}",
            "jsonUrl": f"/files/json/{json_path.name}",
        })

        json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    payload["_redactedImageArray"] = redacted_image
    return payload


@app.post("/process")
async def process_upload(
    file: UploadFile = File(...),
    engine: Literal["auto", "hybrid", "yolo", "ocr"] = "auto",
    mode: Literal["blur", "black", "pixelate"] = "blur",
    conf: float = DEFAULT_YOLO_CONF,
    imgsz: int = DEFAULT_IMGSZ,
    redact_photo: bool = False,
    rotation_ocr: bool = False,
    ocr_passes: Literal["fast", "balanced"] = "fast",
):
    payload = await _process_common(
        file,
        engine=engine,
        mode=mode,
        conf=conf,
        imgsz=imgsz,
        redact_photo=redact_photo,
        rotation_ocr=rotation_ocr,
        ocr_passes=ocr_passes,
        save_outputs=True,
    )
    payload.pop("_redactedImageArray", None)
    return JSONResponse(payload)


# Alias for older frontend code that calls /redact.
@app.post("/redact")
async def redact_alias(
    file: UploadFile = File(...),
    engine: Literal["auto", "hybrid", "yolo", "ocr"] = "auto",
    mode: Literal["blur", "black", "pixelate"] = "blur",
    conf: float = DEFAULT_YOLO_CONF,
    imgsz: int = DEFAULT_IMGSZ,
    redact_photo: bool = False,
    rotation_ocr: bool = False,
    ocr_passes: Literal["fast", "balanced"] = "fast",
):
    return await process_upload(file, engine, mode, conf, imgsz, redact_photo, rotation_ocr, ocr_passes)


@app.post("/redact-image")
async def redact_image_upload(
    file: UploadFile = File(...),
    engine: Literal["auto", "hybrid", "yolo", "ocr"] = "auto",
    mode: Literal["blur", "black", "pixelate"] = "blur",
    conf: float = DEFAULT_YOLO_CONF,
    imgsz: int = DEFAULT_IMGSZ,
    redact_photo: bool = False,
    rotation_ocr: bool = False,
    ocr_passes: Literal["fast", "balanced"] = "fast",
):
    payload = await _process_common(
        file,
        engine=engine,
        mode=mode,
        conf=conf,
        imgsz=imgsz,
        redact_photo=redact_photo,
        rotation_ocr=rotation_ocr,
        ocr_passes=ocr_passes,
        save_outputs=False,
    )
    redacted_image = payload.pop("_redactedImageArray")
    ok, encoded = cv2.imencode(".png", redacted_image)
    if not ok:
        raise HTTPException(status_code=500, detail="Could not encode redacted image.")
    return Response(
        content=encoded.tobytes(),
        media_type="image/png",
        headers={
            "Content-Disposition": 'inline; filename="redacted.png"',
            "X-Engine-Used": str(payload.get("engineUsed")),
            "X-Sensitive-Count": str(payload.get("sensitiveCount", 0)),
            "X-Redacted-Count": str(payload.get("redactedCount", 0)),
            "X-Device": DEVICE,
        },
    )


@app.post("/extract")
async def extract_upload(
    file: UploadFile = File(...),
    rotation_ocr: bool = False,
    ocr_passes: Literal["fast", "balanced"] = "fast",
):
    payload = await _process_common(
        file,
        engine="ocr",
        mode="blur",
        conf=DEFAULT_YOLO_CONF,
        imgsz=DEFAULT_IMGSZ,
        redact_photo=False,
        rotation_ocr=rotation_ocr,
        ocr_passes=ocr_passes,
        save_outputs=False,
    )
    payload.pop("_redactedImageArray", None)
    return JSONResponse(payload)
