#!/usr/bin/env python3
"""
Nepali/English document redactor + extractor.

What it does
------------
1. Saves an untouched copy in output/originals.
2. Saves a redacted copy in output/redacted.
3. Saves OCR, detections, and extracted key/value data in output/json.
4. Supports English digits and Nepali/Devanagari digits: ०१२३४५६७८९.
5. Tries to redact only the matched value inside an OCR line instead of blurring the whole line.

Example:
    python nepali_document_redactor.py \
        --input samples/id.jpg \
        --output output \
        --id-document \
        --mode blur \
        --redact-dates

For irreversible sharing, prefer --mode black or --mode pixelate over --mode blur.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import shutil
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import cv2
import easyocr
import numpy as np


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"}
NEPALI_DIGIT_TABLE = str.maketrans("०१२३४५६७८९", "0123456789")
ASCII_TO_NEPALI_DIGIT_TABLE = str.maketrans("0123456789", "०१२३४५६७८९")
D = r"0-9०-९"


@dataclass
class OCRItem:
    text: str
    confidence: float
    bbox: List[int]
    variant: str


@dataclass
class Detection:
    category: str
    value: str
    confidence: float
    bbox: List[int]
    reason: str
    source_text: str
    redacted: bool = False
    skip_reason: str = ""


@dataclass
class ExtractedField:
    key: str
    value: str
    confidence: float
    source_text: str
    bbox: List[int]


# ----------------------------- geometry helpers -----------------------------


def polygon_to_bbox(poly: Iterable[Iterable[float]], scale: float = 1.0) -> List[int]:
    pts = np.array(poly, dtype=np.float32) / max(scale, 1e-6)
    x1, y1 = pts.min(axis=0)
    x2, y2 = pts.max(axis=0)
    return [int(round(x1)), int(round(y1)), int(round(x2)), int(round(y2))]


def clamp_bbox(bbox: List[int], image_shape: Sequence[int]) -> List[int]:
    h, w = image_shape[:2]
    x1, y1, x2, y2 = bbox
    return [
        max(0, min(w - 1, int(x1))),
        max(0, min(h - 1, int(y1))),
        max(0, min(w - 1, int(x2))),
        max(0, min(h - 1, int(y2))),
    ]


def expand_bbox(bbox: List[int], image_shape: Sequence[int], pad: int = 7) -> List[int]:
    x1, y1, x2, y2 = bbox
    return clamp_bbox([x1 - pad, y1 - pad, x2 + pad, y2 + pad], image_shape)


def union_bbox(boxes: Sequence[List[int]]) -> List[int]:
    if not boxes:
        return [0, 0, 0, 0]
    return [
        min(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        max(b[3] for b in boxes),
    ]


def bbox_area(b: List[int]) -> int:
    return max(0, b[2] - b[0]) * max(0, b[3] - b[1])


def bbox_overlap_ratio(a: List[int], b: List[int]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    if ix2 <= ix1 or iy2 <= iy1:
        return 0.0
    inter = (ix2 - ix1) * (iy2 - iy1)
    return inter / max(1, min(bbox_area(a), bbox_area(b)))


def is_oversized_redaction_box(
    bbox: List[int],
    image_shape: Sequence[int],
    max_area_ratio: float = 0.12,
    max_height_ratio: float = 0.45,
) -> bool:
    h, w = image_shape[:2]
    x1, y1, x2, y2 = bbox
    bw = max(1, x2 - x1)
    bh = max(1, y2 - y1)
    area_ratio = (bw * bh) / max(1, w * h)
    width_ratio = bw / max(1, w)
    height_ratio = bh / max(1, h)
    return area_ratio > max_area_ratio or height_ratio > max_height_ratio or (width_ratio > 0.85 and height_ratio > 0.12)


# ----------------------------- text helpers -----------------------------


def to_ascii_digits(s: str) -> str:
    return (s or "").translate(NEPALI_DIGIT_TABLE)


def to_nepali_digits(s: str) -> str:
    return (s or "").translate(ASCII_TO_NEPALI_DIGIT_TABLE)


def normalize_digits(s: str) -> str:
    return re.sub(r"\D", "", to_ascii_digits(s or ""))


def normalize_text(s: str) -> str:
    s = s or ""
    s = s.replace("：", ":").replace("।", " ")
    s = re.sub(r"[\t\r\n]+", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def compact_for_compare(s: str) -> str:
    s = to_ascii_digits(normalize_text(s)).lower()
    s = re.sub(r"[\s:;,.\-/()_]+", "", s)
    return s


def clean_value(v: str) -> str:
    v = normalize_text(v)
    v = re.sub(r"^[\s:;,.\-/()]+", "", v)
    v = re.sub(r"[\s:;,.\-/()]+$", "", v)
    return v.strip()


def mask_value(value: str) -> str:
    """Optional JSON masking. Keeps the shape but hides most of the value."""
    if not value:
        return value
    digits = normalize_digits(value)
    if len(digits) >= 6:
        return re.sub(rf"[{D}]", "•", value[:-4]) + value[-4:]
    if len(value) <= 2:
        return "•" * len(value)
    return value[0] + ("•" * max(1, len(value) - 2)) + value[-1]


# ----------------------------- regex patterns -----------------------------


EMAIL_RE = re.compile(r"\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b", re.I)
URL_RE = re.compile(r"\b(?:https?://|www\.)[^\s,;]+", re.I)

# English + Nepali digit aware.
NEPAL_MOBILE_RE = re.compile(rf"(?<![{D}])(?:\+?(?:977|९७७)[\s\-]?)?[9९][78७८][{D}]{{8}}(?![{D}])")
PHONE_RE = re.compile(rf"(?<![\w{D}])(?:\+?[{D}][{D}\s().\-]{{7,}}[{D}])(?![\w{D}])")

# Common Nepal ID/license-like forms: 01-01-123456, २६-०१-७७-०११३३, etc.
DASHED_ID_RE = re.compile(rf"(?<![{D}])(?:[{D}]{{1,4}}\s*[-/]\s*){{1,5}}[{D}]{{2,10}}(?![{D}])")
LONG_NUMBER_RE = re.compile(rf"(?<![{D}])[{D}]{{6,18}}(?![{D}])")
DL_NO_RE = re.compile(rf"(?<![{D}])[{D}]{{2}}\s*[-/]\s*[{D}]{{2}}\s*[-/]\s*[{D}]{{5,10}}(?![{D}])")
PASSPORT_NO_RE = re.compile(rf"\b[A-Z][A-Z0-9]?\s*[-/]?\s*[{D}]{{6,9}}\b", re.I)
PAYMENT_CARD_CANDIDATE_RE = re.compile(rf"\b(?:[{D}][ -]?){12,19}\b")

DATE_NUMERIC_RE = re.compile(rf"(?<![{D}])(?:[{D}]{{4}}[-/.][{D}]{{1,2}}[-/.][{D}]{{1,2}}|[{D}]{{1,2}}[-/.][{D}]{{1,2}}[-/.][{D}]{{2,4}})(?![{D}])")
DATE_TEXT_RE = re.compile(rf"\b(?:[{D}]{{1,2}}\s+[A-Z]{{3,9}}\s+[{D}]{{2,4}}|[A-Z]{{3,9}}\s+[{D}]{{1,2}},?\s+[{D}]{{2,4}})\b", re.I)
NEPALI_BS_COMPONENT_DATE_RE = re.compile(
    rf"(?:साल|year)\D*([{D}]{{2,4}}).*?(?:महिना|month)\D*([{D}]{{1,2}}).*?(?:गते|दिन|day|date)\D*([{D}]{{1,2}})",
    re.I,
)

DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")

# Context labels. Keep them broad; redaction is still value-only.
CITIZENSHIP_LABEL_RE = re.compile(r"(ना\.?\s*प्र\.?\s*नं\.?|नागरिकता\s*(?:नं|नम्बर|प्रमाणपत्र)?|citizenship\s*(?:no|num|number)?|national\s*id)", re.I)
LICENSE_LABEL_RE = re.compile(r"(सवारी\s*चालक|चालक\s*अनुमति|driver'?s?\s*licen[cs]e|driving\s*licen[cs]e|d\.?\s*l\.?\s*no\.?|license\s*(?:no|num|number)?)", re.I)
PASSPORT_LABEL_RE = re.compile(r"(राहदानी|passport\s*(?:no|num|number)?)", re.I)
PHONE_LABEL_RE = re.compile(r"(फोन|मोबाइल|सम्पर्क|contact|mobile|phone)", re.I)
DOB_LABEL_RE = re.compile(r"(जन्म\s*मिति|dob|d\.?\s*o\.?\s*b\.?|date\s*of\s*birth|birth\s*date)", re.I)
DOI_LABEL_RE = re.compile(r"(जारी\s*मिति|issue\s*date|date\s*of\s*issue|doi|d\.?\s*o\.?\s*i\.?)", re.I)
DOE_LABEL_RE = re.compile(r"(म्याद|बहाल|expiry|expire|date\s*of\s*expiry|doe|d\.?\s*o\.?\s*e\.?)", re.I)
NAME_LABEL_RE = re.compile(r"(नाम\s*थर|नाम|full\s*name|name)", re.I)
FATHER_LABEL_RE = re.compile(r"(बाबु|बुवा|father'?s?\s*name|father|f/h\s*name)", re.I)
MOTHER_LABEL_RE = re.compile(r"(आमा|mother'?s?\s*name|mother)", re.I)
ADDRESS_LABEL_RE = re.compile(r"(ठेगाना|स्थायी\s*वासस्थान|स्थायी|अस्थायी|address|permanent\s*address|temporary\s*address)", re.I)
DISTRICT_LABEL_RE = re.compile(r"(जिल्ला|district)", re.I)
WARD_LABEL_RE = re.compile(r"(वडा\s*(?:नं|नम्बर)?|ward\s*(?:no|number)?)", re.I)
GENDER_LABEL_RE = re.compile(r"(लिङ्ग|लिंग|sex|gender)", re.I)

# Labels whose VALUE should be blurred in full ID-field redaction mode.
# This is what makes the output look like your sample: labels remain mostly visible, values are blurred.
PERSONAL_ID_VALUE_LABEL_RE = re.compile(
    r"("
    # Nepali citizenship/card fields
    r"ना\.?\s*प्र\.?\s*नं\.?|नागरिकता\s*(?:नं|नम्बर|प्रमाणपत्र)?|"
    r"नाम\s*थर|नाम|जन्म\s*स्थान|जन्मस्थान|जन्म\s*मिति|जन्ममिति|"
    r"बाबु|बुवा|आमा|पति|पत्नी|बाजे|"
    r"स्थायी\s*वासस्थान|स्थायी|अस्थायी|ठेगाना|"
    r"जिल्ला|गा\.?\s*पा\.?|गाउँपालिका|नगरपालिका|न\.?\s*पा\.?|वडा\s*(?:नं|नम्बर)?|"
    r"लिङ्ग|लिंग|फोन|मोबाइल|सम्पर्क|"
    # English driving-license/passport/card fields
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

PASSWORD_LABEL_RE = re.compile(r"\b(pass(?:word)?|pwd|pin|otp|secret|token|api[_\s-]?key|private[_\s-]?key)\b", re.I)
BANK_LABEL_RE = re.compile(r"(bank\s*account|account\s*(?:no|number)|iban|swift)", re.I)

ID_DOCUMENT_HINT_RE = re.compile(
    r"(नागरिकता|प्रमाणपत्र|राहदानी|सवारी\s*चालक|जिल्ला\s*प्रशासन|citizenship|passport|license|licence|national\s*id|government\s*of\s*nepal)",
    re.I,
)

NON_VALUE_HEADERS_RE = re.compile(
    r"\b(government|nepal|department|transport|management|category|issued\s+by|signature\s+of\s+holder)\b",
    re.I,
)

# Text that should normally remain visible in aggressive ID mode.
# Values are blurred; form labels and official headings are kept when OCR separates them.
SAFE_LABEL_OR_HEADER_RE = re.compile(
    r"^(?:"
    r"government(?:\s+of\s+nepal)?|nepal\s+government|driving\s+licen[cs]e|"
    r"issued\s+by|signature\s+of\s+holder|category|"
    r"d\.?\s*l\.?\s*no\.?|b\.?\s*g\.?|d\.?\s*o\.?\s*b\.?|d\.?\s*o\.?\s*i\.?|d\.?\s*o\.?\s*e\.?|"
    r"name|address|f\s*/?\s*h\s*name|father'?s?\s*name|mother'?s?\s*name|"
    r"citizenship\s*(?:no|num|number)?|passport\s*(?:no|num|number)?|phone\s*(?:no|num|number)?|mobile\s*(?:no|num|number)?|"
    r"नेपाल\s*सरकार|गृह\s*मन्त्रालय|जिल्ला\s*प्रशासन\s*कार्यालय|नेपाली\s*नागरिकताको\s*प्रमाणपत्र|"
    r"नाम\s*थर|नाम|जन्म\s*स्थान|जन्मस्थान|जन्म\s*मिति|जन्ममिति|"
    r"बाबु|बुवा|आमा|पति|पत्नी|बाजे|स्थायी\s*वासस्थान|स्थायी|अस्थायी|ठेगाना|"
    r"जिल्ला|गा\.?\s*पा\.?|गाउँपालिका|नगरपालिका|न\.?\s*पा\.?|वडा\s*(?:नं|नम्बर)?|लिङ्ग|लिंग|फोन|मोबाइल|सम्पर्क"
    r")\s*[:：.\-/]*$",
    re.I,
)


def text_has_real_value(text: str) -> bool:
    t = clean_value(text)
    if not t:
        return False
    if SAFE_LABEL_OR_HEADER_RE.fullmatch(t):
        return False
    if NON_VALUE_HEADERS_RE.search(t) and not re.search(rf"[{D}]", t):
        return False
    # Avoid blurring tiny punctuation or one-letter labels.
    if len(compact_for_compare(t)) < 2:
        return False
    return bool(re.search(rf"[A-Za-z\u0900-\u097F{D}]", t))


# ----------------------------- OCR helpers -----------------------------


def preprocess_variants(image: np.ndarray, ocr_passes: str) -> List[Tuple[str, np.ndarray, float]]:
    """
    Return OCR variants as (name, image, scale_factor).

    fast     = one OCR pass; quickest on CPU.
    balanced = original + CLAHE; good default for CPU.
    accurate = extra sharpen/threshold/upscale passes; slow but catches more text.
    """
    variants: List[Tuple[str, np.ndarray, float]] = [("original", image, 1.0)]
    if ocr_passes == "fast":
        return variants

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    clahe_gray = clahe.apply(gray)
    variants.append(("clahe", cv2.cvtColor(clahe_gray, cv2.COLOR_GRAY2BGR), 1.0))

    if ocr_passes != "accurate":
        return variants

    blur = cv2.GaussianBlur(image, (0, 0), 1.0)
    sharpen = cv2.addWeighted(image, 1.65, blur, -0.65, 0)
    variants.append(("sharpen", sharpen, 1.0))

    th = cv2.adaptiveThreshold(
        clahe_gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        11,
    )
    variants.append(("adaptive_threshold", cv2.cvtColor(th, cv2.COLOR_GRAY2BGR), 1.0))

    # Phone-camera ID photos often OCR better when enlarged first, but this is slow on CPU.
    h, w = image.shape[:2]
    if max(h, w) < 1800:
        scale = 1.45
        up = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        variants.append(("upscale_1_45", up, scale))

    return variants


def run_easyocr(reader: easyocr.Reader, image: np.ndarray, rotation_ocr: bool) -> List[Any]:
    kwargs: Dict[str, Any] = dict(
        detail=1,
        paragraph=False,
        mag_ratio=1.7,
        contrast_ths=0.03,
        adjust_contrast=0.8,
        text_threshold=0.45,
        low_text=0.20,
        link_threshold=0.25,
        width_ths=0.80,
    )
    if rotation_ocr:
        kwargs["rotation_info"] = [90, 180, 270]
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    return reader.readtext(rgb, **kwargs)


def dedupe_ocr_items(items: List[OCRItem]) -> List[OCRItem]:
    out: List[OCRItem] = []
    # Prefer higher confidence and smaller boxes, then top-to-bottom order.
    for item in sorted(items, key=lambda x: (-x.confidence, bbox_area(x.bbox), x.bbox[1], x.bbox[0])):
        text_key = compact_for_compare(item.text)
        if not text_key:
            continue
        dup = False
        for ex in out:
            ex_key = compact_for_compare(ex.text)
            overlap = bbox_overlap_ratio(item.bbox, ex.bbox)
            if overlap > 0.85:
                dup = True
                break
            if text_key == ex_key and overlap > 0.45:
                dup = True
                break
        if not dup:
            out.append(item)
    return sorted(out, key=lambda x: (x.bbox[1], x.bbox[0]))


def make_line_groups(ocr_items: List[OCRItem]) -> List[List[OCRItem]]:
    groups: List[List[OCRItem]] = []
    for item in sorted(ocr_items, key=lambda x: (x.bbox[1], x.bbox[0])):
        x1, y1, x2, y2 = item.bbox
        cy = (y1 + y2) / 2
        h = max(1, y2 - y1)
        placed = False
        for group in groups:
            gy1 = min(i.bbox[1] for i in group)
            gy2 = max(i.bbox[3] for i in group)
            gh = max(1, gy2 - gy1)
            tolerance = max(8, int(0.50 * max(h, gh)))
            if gy1 - tolerance <= cy <= gy2 + tolerance:
                group.append(item)
                placed = True
                break
        if not placed:
            groups.append([item])
    return [sorted(g, key=lambda i: i.bbox[0]) for g in groups]


def join_line(group: List[OCRItem]) -> Tuple[str, List[int], List[Tuple[int, int, List[int]]], float]:
    """Return line text, line bbox, token spans, average confidence."""
    parts: List[str] = []
    spans: List[Tuple[int, int, List[int]]] = []
    pos = 0
    for item in group:
        if parts:
            parts.append(" ")
            pos += 1
        text = normalize_text(item.text)
        start = pos
        parts.append(text)
        pos += len(text)
        spans.append((start, pos, item.bbox))
    line_text = "".join(parts)
    line_bbox = union_bbox([i.bbox for i in group])
    avg_conf = sum(i.confidence for i in group) / max(1, len(group))
    return line_text, line_bbox, spans, avg_conf


def bbox_for_span(
    full_text: str,
    span: Tuple[int, int],
    line_bbox: List[int],
    token_spans: Optional[List[Tuple[int, int, List[int]]]] = None,
) -> List[int]:
    """
    Estimate a bounding box for only the matching substring.
    EasyOCR often returns a whole line; this prevents blurring labels and unrelated text.
    """
    start, end = span
    start = max(0, min(len(full_text), start))
    end = max(start + 1, min(len(full_text), end))

    if token_spans:
        boxes: List[List[int]] = []
        for ts, te, tb in token_spans:
            if start >= te or end <= ts:
                continue
            token_text_len = max(1, te - ts)
            tx1, ty1, tx2, ty2 = tb
            # If the match only covers part of a token, approximate inside the token box.
            local_start = max(0, start - ts) / token_text_len
            local_end = min(token_text_len, end - ts) / token_text_len
            sx1 = int(round(tx1 + (tx2 - tx1) * local_start))
            sx2 = int(round(tx1 + (tx2 - tx1) * local_end))
            if sx2 - sx1 < 4:
                sx2 = min(tx2, sx1 + 4)
            boxes.append([sx1, ty1, sx2, ty2])
        if boxes:
            return union_bbox(boxes)

    # Fallback: proportional bbox along the full line.
    x1, y1, x2, y2 = line_bbox
    n = max(1, len(full_text))
    sx1 = int(round(x1 + (x2 - x1) * (start / n)))
    sx2 = int(round(x1 + (x2 - x1) * (end / n)))
    if sx2 - sx1 < 4:
        sx2 = min(x2, sx1 + 4)
    return [sx1, y1, sx2, y2]


# ----------------------------- detection/extraction -----------------------------


def luhn_check(number: str) -> bool:
    digits = [int(d) for d in normalize_digits(number)]
    if not 12 <= len(digits) <= 19:
        return False
    checksum = 0
    parity = len(digits) % 2
    for i, d in enumerate(digits):
        if i % 2 == parity:
            d *= 2
            if d > 9:
                d -= 9
        checksum += d
    return checksum % 10 == 0


def add_detection(
    detections: List[Detection],
    category: str,
    value: str,
    conf: float,
    bbox: List[int],
    reason: str,
    source_text: str,
    boost: float = 0.0,
) -> None:
    value = clean_value(value)
    source_text = normalize_text(source_text)
    if not value:
        return
    detections.append(
        Detection(
            category=category,
            value=value,
            confidence=max(0.0, min(1.0, float(conf) + boost)),
            bbox=[int(v) for v in bbox],
            reason=reason,
            source_text=source_text,
        )
    )


def add_field(
    fields: List[ExtractedField],
    key: str,
    value: str,
    conf: float,
    bbox: List[int],
    source_text: str,
) -> None:
    value = clean_value(value)
    if not value:
        return
    fields.append(
        ExtractedField(
            key=key,
            value=value,
            confidence=max(0.0, min(1.0, float(conf))),
            source_text=normalize_text(source_text),
            bbox=[int(v) for v in bbox],
        )
    )


def detect_regex_patterns(
    text: str,
    line_bbox: List[int],
    conf: float,
    detections: List[Detection],
    token_spans: Optional[List[Tuple[int, int, List[int]]]] = None,
    *,
    strict: bool = False,
    id_document: bool = False,
) -> None:
    raw = normalize_text(text)
    if not raw:
        return

    for m in EMAIL_RE.finditer(raw):
        add_detection(detections, "email", m.group(0), conf, bbox_for_span(raw, m.span(), line_bbox, token_spans), "email pattern", raw, 0.06)

    for m in URL_RE.finditer(raw):
        add_detection(detections, "url", m.group(0), conf, bbox_for_span(raw, m.span(), line_bbox, token_spans), "url pattern", raw, 0.04)

    for m in NEPAL_MOBILE_RE.finditer(raw):
        add_detection(detections, "phone_number", m.group(0), conf, bbox_for_span(raw, m.span(), line_bbox, token_spans), "Nepal mobile pattern", raw, 0.10)

    for m in PHONE_RE.finditer(raw):
        digits = normalize_digits(m.group(0))
        # Avoid classifying every citizenship/ward/date string as phone unless it is plausibly phone length.
        if 8 <= len(digits) <= 15:
            add_detection(detections, "phone_number", m.group(0), conf, bbox_for_span(raw, m.span(), line_bbox, token_spans), "phone-like pattern", raw, 0.02)

    for m in PAYMENT_CARD_CANDIDATE_RE.finditer(raw):
        digits = normalize_digits(m.group(0))
        if luhn_check(digits):
            add_detection(detections, "payment_card", m.group(0), conf, bbox_for_span(raw, m.span(), line_bbox, token_spans), "Luhn-valid payment card", raw, 0.12)

    if PASSWORD_LABEL_RE.search(raw):
        # Blur the whole token/line because secrets are often alphanumeric and not predictable.
        add_detection(detections, "password_or_secret", raw, conf, line_bbox, "password/secret label", raw, 0.12)

    if BANK_LABEL_RE.search(raw):
        for m in LONG_NUMBER_RE.finditer(raw):
            add_detection(detections, "bank_account_number", m.group(0), conf, bbox_for_span(raw, m.span(), line_bbox, token_spans), "bank account label + long number", raw, 0.12)

    if LICENSE_LABEL_RE.search(raw):
        for pattern in (DL_NO_RE, DASHED_ID_RE, LONG_NUMBER_RE):
            for m in pattern.finditer(raw):
                if len(normalize_digits(m.group(0))) >= 5:
                    add_detection(detections, "drivers_license_number", m.group(0), conf, bbox_for_span(raw, m.span(), line_bbox, token_spans), "license label + number", raw, 0.14)

    if CITIZENSHIP_LABEL_RE.search(raw):
        for pattern in (DASHED_ID_RE, LONG_NUMBER_RE):
            for m in pattern.finditer(raw):
                if len(normalize_digits(m.group(0))) >= 5:
                    add_detection(detections, "citizenship_number", m.group(0), conf, bbox_for_span(raw, m.span(), line_bbox, token_spans), "citizenship/national ID label + number", raw, 0.15)

    if PASSPORT_LABEL_RE.search(raw):
        for pattern in (PASSPORT_NO_RE, LONG_NUMBER_RE):
            for m in pattern.finditer(raw):
                if len(normalize_digits(m.group(0))) >= 6:
                    add_detection(detections, "passport_number", m.group(0), conf, bbox_for_span(raw, m.span(), line_bbox, token_spans), "passport label + number", raw, 0.15)

    if strict or id_document:
        # Date detection is controlled later by redaction categories, but extracted here for review.
        for pattern in (DATE_NUMERIC_RE, DATE_TEXT_RE):
            for m in pattern.finditer(raw):
                add_detection(detections, "date", m.group(0), conf, bbox_for_span(raw, m.span(), line_bbox, token_spans), "date pattern", raw, 0.06)

        for m in NEPALI_BS_COMPONENT_DATE_RE.finditer(raw):
            date_value = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
            add_detection(detections, "date", date_value, conf, bbox_for_span(raw, (m.start(1), m.end(3)), line_bbox, token_spans), "Nepali BS date components", raw, 0.08)
            # Also add each number separately for tighter redaction.
            for idx in (1, 2, 3):
                add_detection(detections, "date_component", m.group(idx), conf, bbox_for_span(raw, m.span(idx), line_bbox, token_spans), "Nepali BS date component", raw, 0.08)

        for m in DL_NO_RE.finditer(raw):
            add_detection(detections, "drivers_license_number", m.group(0), conf, bbox_for_span(raw, m.span(), line_bbox, token_spans), "Nepal-style license number", raw, 0.10)

        # Generic ID fallback. It is deliberately lower confidence to avoid false positives.
        for m in DASHED_ID_RE.finditer(raw):
            digits = normalize_digits(m.group(0))
            if len(digits) >= 6:
                add_detection(detections, "possible_identifier", m.group(0), conf, bbox_for_span(raw, m.span(), line_bbox, token_spans), "dashed ID-like number fallback", raw, -0.01)

        for m in LONG_NUMBER_RE.finditer(raw):
            digits = normalize_digits(m.group(0))
            if len(digits) >= 7:
                add_detection(detections, "possible_identifier", m.group(0), conf, bbox_for_span(raw, m.span(), line_bbox, token_spans), "long number fallback", raw, -0.05)


def extract_value_after_label(
    label_re: re.Pattern[str],
    value_re: re.Pattern[str],
    key: str,
    text: str,
    line_bbox: List[int],
    token_spans: List[Tuple[int, int, List[int]]],
    conf: float,
    fields: List[ExtractedField],
    detections: List[Detection],
    detection_category: Optional[str] = None,
    reason: str = "label + value",
) -> None:
    raw = normalize_text(text)
    label_match = label_re.search(raw)
    if not label_match:
        return

    # Prefer value after the label, but fall back to anywhere on the line.
    search_regions = [(label_match.end(), len(raw)), (0, len(raw))]
    for region_start, region_end in search_regions:
        sub = raw[region_start:region_end]
        m = value_re.search(sub)
        if not m:
            continue
        start = region_start + m.start()
        end = region_start + m.end()
        value = raw[start:end]
        box = bbox_for_span(raw, (start, end), line_bbox, token_spans)
        add_field(fields, key, value, conf, box, raw)
        if detection_category:
            add_detection(detections, detection_category, value, conf, box, reason, raw, 0.12)
        return


def extract_text_field_after_label(
    label_re: re.Pattern[str],
    key: str,
    text: str,
    line_bbox: List[int],
    token_spans: List[Tuple[int, int, List[int]]],
    conf: float,
    fields: List[ExtractedField],
    detections: List[Detection],
    detection_category: Optional[str] = None,
) -> None:
    raw = normalize_text(text)
    m = label_re.search(raw)
    if not m:
        return
    value = raw[m.end():]
    value = re.sub(r"^[\s:;,.\-/]+", "", value)
    # Stop if OCR captured another label after the value.
    value = re.split(r"\s{3,}|(?=\b(?:district|ward|dob|phone|mobile)\b)|(?=(?:जिल्ला|वडा|जन्म|फोन|मोबाइल))", value, maxsplit=1)[0]
    value = clean_value(value)
    if len(value) < 2 or NON_VALUE_HEADERS_RE.search(value):
        return
    start = raw.find(value, m.end())
    if start < 0:
        start = m.end()
    end = start + len(value)
    box = bbox_for_span(raw, (start, end), line_bbox, token_spans)
    add_field(fields, key, value, conf, box, raw)
    if detection_category:
        add_detection(detections, detection_category, value, conf, box, f"{key} label + text", raw, 0.06)


def extract_line_fields(
    text: str,
    line_bbox: List[int],
    token_spans: List[Tuple[int, int, List[int]]],
    conf: float,
    fields: List[ExtractedField],
    detections: List[Detection],
) -> None:
    raw = normalize_text(text)
    if not raw:
        return

    extract_value_after_label(CITIZENSHIP_LABEL_RE, DASHED_ID_RE, "citizenship_number", raw, line_bbox, token_spans, conf, fields, detections, "citizenship_number", "citizenship label + number")
    extract_value_after_label(CITIZENSHIP_LABEL_RE, LONG_NUMBER_RE, "citizenship_number", raw, line_bbox, token_spans, conf, fields, detections, "citizenship_number", "citizenship label + long number")
    extract_value_after_label(LICENSE_LABEL_RE, DL_NO_RE, "drivers_license_number", raw, line_bbox, token_spans, conf, fields, detections, "drivers_license_number", "license label + number")
    extract_value_after_label(PASSPORT_LABEL_RE, PASSPORT_NO_RE, "passport_number", raw, line_bbox, token_spans, conf, fields, detections, "passport_number", "passport label + number")
    extract_value_after_label(PHONE_LABEL_RE, NEPAL_MOBILE_RE, "phone_number", raw, line_bbox, token_spans, conf, fields, detections, "phone_number", "phone label + mobile number")
    extract_value_after_label(PHONE_LABEL_RE, PHONE_RE, "phone_number", raw, line_bbox, token_spans, conf, fields, detections, "phone_number", "phone label + phone number")

    # Dates: numeric date and Nepali BS component date.
    for label_re, key, cat in (
        (DOB_LABEL_RE, "date_of_birth", "date_of_birth"),
        (DOI_LABEL_RE, "date_of_issue", "date_of_issue"),
        (DOE_LABEL_RE, "date_of_expiry", "date_of_expiry"),
    ):
        extract_value_after_label(label_re, DATE_NUMERIC_RE, key, raw, line_bbox, token_spans, conf, fields, detections, cat, f"{key} label + date")
        label_match = label_re.search(raw)
        m = NEPALI_BS_COMPONENT_DATE_RE.search(raw)
        if label_match and m:
            date_value = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
            box = bbox_for_span(raw, (m.start(1), m.end(3)), line_bbox, token_spans)
            add_field(fields, key, date_value, conf, box, raw)
            add_detection(detections, cat, date_value, conf, box, f"{key} Nepali BS components", raw, 0.10)
            for idx in (1, 2, 3):
                add_detection(detections, "date_component", m.group(idx), conf, bbox_for_span(raw, m.span(idx), line_bbox, token_spans), f"{key} component", raw, 0.08)

    # Basic document text fields. They are extracted, but redaction is optional by CLI.
    extract_text_field_after_label(NAME_LABEL_RE, "name", raw, line_bbox, token_spans, conf, fields, detections, "person_name")
    extract_text_field_after_label(FATHER_LABEL_RE, "father_name", raw, line_bbox, token_spans, conf, fields, detections, "father_name")
    extract_text_field_after_label(MOTHER_LABEL_RE, "mother_name", raw, line_bbox, token_spans, conf, fields, detections, "mother_name")
    extract_text_field_after_label(ADDRESS_LABEL_RE, "address", raw, line_bbox, token_spans, conf, fields, detections, "address")
    extract_text_field_after_label(DISTRICT_LABEL_RE, "district", raw, line_bbox, token_spans, conf, fields, detections, None)
    extract_value_after_label(WARD_LABEL_RE, re.compile(rf"[{D}]{{1,3}}"), "ward_number", raw, line_bbox, token_spans, conf, fields, detections, None, "ward label + number")
    extract_text_field_after_label(GENDER_LABEL_RE, "gender", raw, line_bbox, token_spans, conf, fields, detections, None)


def add_id_field_value_detections(
    text: str,
    line_bbox: List[int],
    token_spans: List[Tuple[int, int, List[int]]],
    conf: float,
    detections: List[Detection],
    *,
    min_confidence: float = 0.18,
) -> None:
    """
    Blur values after Nepali/English ID labels.

    This is intentionally broader than number-only regex redaction.
    It catches names, birthplace, address, parent names, gender, ward, district, etc.
    The label itself is not blurred when OCR span estimation is possible.
    """
    if conf < min_confidence:
        return

    raw = normalize_text(text)
    if not raw or NON_VALUE_HEADERS_RE.search(raw):
        return

    matches = list(PERSONAL_ID_VALUE_LABEL_RE.finditer(raw))
    if not matches:
        return

    for idx, m in enumerate(matches):
        value_start = m.end()

        # Skip punctuation/separators after label.
        while value_start < len(raw) and raw[value_start] in " \t:-–—;,./()।":
            value_start += 1

        value_end = matches[idx + 1].start() if idx + 1 < len(matches) else len(raw)
        while value_end > value_start and raw[value_end - 1] in " \t:-–—;,./()।":
            value_end -= 1

        if value_end <= value_start:
            continue

        value = clean_value(raw[value_start:value_end])
        if not value:
            continue

        # Avoid blurring only label words or document headers.
        if PERSONAL_ID_VALUE_LABEL_RE.fullmatch(value) or ID_DOCUMENT_HINT_RE.fullmatch(value) or NON_VALUE_HEADERS_RE.search(value):
            continue

        # Require at least one real letter/digit. This avoids separator-only boxes.
        if not re.search(rf"[A-Za-z\u0900-\u097F{D}]", value):
            continue

        box = bbox_for_span(raw, (value_start, value_end), line_bbox, token_spans)
        add_detection(
            detections,
            "id_field_value",
            value,
            conf,
            box,
            "full ID-field blur: value after sensitive label",
            raw,
            0.08,
        )


def add_wrapped_id_field_redactions(
    line_infos: List[Dict[str, Any]],
    detections: List[Detection],
    *,
    max_extra_lines: int = 2,
) -> None:
    """
    Redact continuation lines for wrapped fields, especially driving-license addresses.
    Example:
        Address: semjongchautara-3,Semj
                 ong, Bagmati,Nepal
    OCR often treats the second line as a separate line with no label, so regex alone misses it.
    """
    for idx, info in enumerate(line_infos):
        text = info["text"]
        if not ADDRESS_LABEL_RE.search(text):
            continue

        current_box = info["bbox"]
        current_h = max(1, current_box[3] - current_box[1])
        label_match = ADDRESS_LABEL_RE.search(text)
        if label_match:
            value_box = bbox_for_span(text, (label_match.end(), len(text)), info["bbox"], info["spans"])
            value_left = max(current_box[0], value_box[0] - 20)
        else:
            value_left = current_box[0] + int((current_box[2] - current_box[0]) * 0.35)

        previous_bottom = current_box[3]
        for extra in range(1, max_extra_lines + 1):
            if idx + extra >= len(line_infos):
                break
            nxt = line_infos[idx + extra]
            nxt_text = nxt["text"]
            nxt_box = nxt["bbox"]

            vertical_gap = nxt_box[1] - previous_bottom
            if vertical_gap > current_h * 1.45:
                break
            if PERSONAL_ID_VALUE_LABEL_RE.search(nxt_text):
                break
            if NON_VALUE_HEADERS_RE.search(nxt_text):
                break
            if not re.search(r"[A-Za-z\u0900-\u097F0-9०-९]", nxt_text):
                break

            # Only redact continuation lines aligned with the value column, not unrelated left labels.
            if nxt_box[2] < value_left:
                break
            red_box = [max(value_left, nxt_box[0]), nxt_box[1], nxt_box[2], nxt_box[3]]
            add_detection(
                detections,
                "id_field_value",
                nxt_text,
                float(nxt["conf"]),
                red_box,
                "wrapped ID field continuation blur",
                nxt_text,
                0.08,
            )
            previous_bottom = nxt_box[3]


def add_aggressive_visible_id_text_redactions(
    ocr_items: List[OCRItem],
    detections: List[Detection],
    *,
    min_confidence: float = 0.30,
) -> None:
    """
    Aggressive fallback for real-world ID photos where OCR does not pair labels and values correctly.

    It blurs every visible OCR text item that looks like a value, while skipping common
    official headings and standalone field labels. This is the mode closest to the
    sample image the user showed with many blurred rectangular fields.
    """
    for item in ocr_items:
        text = normalize_text(item.text)
        if item.confidence < min_confidence:
            continue
        if not text_has_real_value(text):
            continue
        # If text contains a personal label, the value-only line logic handles it.
        # Do not blur the whole label+value line unless it also contains obvious digits.
        if PERSONAL_ID_VALUE_LABEL_RE.search(text) and not re.search(rf"[{D}]", text):
            continue
        add_detection(
            detections,
            "visible_id_text",
            text,
            item.confidence,
            item.bbox,
            "aggressive full-ID fallback: visible OCR value text",
            text,
            0.03,
        )


def dedupe_detections(detections: List[Detection]) -> List[Detection]:
    out: List[Detection] = []
    for det in sorted(detections, key=lambda d: (-d.confidence, d.category, bbox_area(d.bbox), -len(d.value))):
        val_key = compact_for_compare(det.value)
        is_dup = False
        for ex in out:
            ex_key = compact_for_compare(ex.value)
            same_category = det.category == ex.category
            same_value = bool(val_key and val_key == ex_key)
            same_box = bbox_overlap_ratio(det.bbox, ex.bbox) > 0.72
            # Dates may create both full-date and component boxes; keep both because components are tighter.
            if det.category == "date_component" or ex.category == "date_component":
                if same_category and same_value and same_box:
                    is_dup = True
                    break
                continue
            if same_category and (same_value or same_box):
                is_dup = True
                break
            if same_value and same_box:
                is_dup = True
                break
        if not is_dup:
            out.append(det)
    return sorted(out, key=lambda d: (d.bbox[1], d.bbox[0], d.category))


def dedupe_fields(fields: List[ExtractedField]) -> List[ExtractedField]:
    out: List[ExtractedField] = []
    for f in sorted(fields, key=lambda x: (-x.confidence, x.key, x.bbox[1], x.bbox[0])):
        key = f.key
        val_key = compact_for_compare(f.value)
        if not val_key:
            continue
        duplicate = False
        for ex in out:
            if key == ex.key and (val_key == compact_for_compare(ex.value) or bbox_overlap_ratio(f.bbox, ex.bbox) > 0.75):
                duplicate = True
                break
        if not duplicate:
            out.append(f)
    return sorted(out, key=lambda f: (f.key, -f.confidence))


# ----------------------------- face detection/redaction -----------------------------


def detect_faces(image: np.ndarray) -> List[List[int]]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    detector = cv2.CascadeClassifier(cascade_path)
    if detector.empty():
        return []
    faces = detector.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=4, minSize=(30, 30))
    boxes: List[List[int]] = []
    for x, y, w, h in faces:
        pad_x = int(w * 0.20)
        pad_y = int(h * 0.25)
        boxes.append([x - pad_x, y - pad_y, x + w + pad_x, y + h + pad_y])
    return [clamp_bbox(b, image.shape) for b in boxes]


def should_skip_for_face_protection(box: List[int], face_boxes: List[List[int]]) -> bool:
    return any(bbox_overlap_ratio(box, face) > 0.12 for face in face_boxes)


def redact_region(image: np.ndarray, bbox: List[int], mode: str) -> None:
    x1, y1, x2, y2 = bbox
    if x2 <= x1 or y2 <= y1:
        return
    roi = image[y1:y2, x1:x2]
    if roi.size == 0:
        return

    h, w = roi.shape[:2]

    if mode == "black":
        # This intentionally creates black bars. Do not use --mode black when you want visual blur.
        image[y1:y2, x1:x2] = 0
        return

    if mode == "pixelate":
        block = 26
        small = cv2.resize(roi, (max(1, w // block), max(1, h // block)), interpolation=cv2.INTER_LINEAR)
        image[y1:y2, x1:x2] = cv2.resize(small, (w, h), interpolation=cv2.INTER_NEAREST)
        return

    # Strong privacy blur/mosaic. Pure Gaussian blur can leave small ID text readable.
    # This creates a frosted patch using heavy blur + mosaic + average-color mixing.
    k = int(max(41, min(181, round(min(h, w) * 1.2))))
    if k % 2 == 0:
        k += 1

    blurred = cv2.GaussianBlur(roi, (k, k), 0)
    blurred = cv2.GaussianBlur(blurred, (k, k), 0)

    # Mosaic after blur destroys readable glyph edges.
    small_w = max(1, w // 18)
    small_h = max(1, h // 18)
    mosaic = cv2.resize(blurred, (small_w, small_h), interpolation=cv2.INTER_LINEAR)
    mosaic = cv2.resize(mosaic, (w, h), interpolation=cv2.INTER_NEAREST)

    # Blend toward local average so it looks like blur, not a black rectangle.
    avg_color = np.mean(roi.reshape(-1, roi.shape[-1]), axis=0).astype(np.uint8)
    avg_patch = np.full_like(roi, avg_color)
    patch = cv2.addWeighted(mosaic, 0.35, avg_patch, 0.65, 0)

    # Tiny deterministic noise prevents banding while keeping the patch natural.
    seed = (x1 * 73856093) ^ (y1 * 19349663) ^ (x2 * 83492791) ^ (y2 * 2654435761)
    rng = np.random.default_rng(seed & 0xFFFFFFFF)
    noise = rng.normal(0, 2.0, patch.shape).astype(np.int16)
    patch = np.clip(patch.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    image[y1:y2, x1:x2] = patch



# ----------------------------- output helpers -----------------------------


def stable_file_id(path: Path) -> str:
    try:
        stat = path.stat()
        raw = f"{path.resolve()}|{stat.st_size}|{stat.st_mtime_ns}".encode("utf-8", errors="ignore")
    except OSError:
        raw = str(path).encode("utf-8", errors="ignore")
    return hashlib.sha1(raw).hexdigest()[:10]


def output_name_for(image_path: Path) -> str:
    return f"{image_path.stem}.{stable_file_id(image_path)}{image_path.suffix.lower()}"


def serialise_ocr_items(items: List[OCRItem]) -> List[Dict[str, Any]]:
    return [asdict(i) for i in items]


def fields_to_dict(fields: List[ExtractedField], mask_json: bool = False) -> Dict[str, List[str]]:
    data: Dict[str, List[str]] = {}
    for f in fields:
        val = mask_value(f.value) if mask_json else f.value
        data.setdefault(f.key, [])
        if val not in data[f.key]:
            data[f.key].append(val)
    return data


def build_structured_summary(
    detections: List[Detection],
    fields: List[ExtractedField],
    ocr_items: List[OCRItem],
    mask_json: bool = False,
) -> Dict[str, Any]:
    summary: Dict[str, Any] = {
        "fields": fields_to_dict(fields, mask_json=mask_json),
        "phone_numbers": [],
        "emails": [],
        "urls": [],
        "dates": [],
        "id_numbers": [],
        "names": [],
        "addresses": [],
        "password_or_secret_lines": [],
        "nepali_text": [],
        "english_text": [],
        "faces": [],
        "manual_review_needed": [],
    }

    for item in ocr_items:
        text = normalize_text(item.text)
        if not text:
            continue
        if DEVANAGARI_RE.search(text):
            summary["nepali_text"].append(text)
        elif re.search(r"[A-Za-z]", text):
            summary["english_text"].append(text)

    for d in detections:
        value = mask_value(d.value) if mask_json else d.value
        if d.category == "phone_number":
            summary["phone_numbers"].append(value)
        elif d.category == "email":
            summary["emails"].append(value)
        elif d.category == "url":
            summary["urls"].append(value)
        elif d.category in {"date", "date_of_birth", "date_of_issue", "date_of_expiry"}:
            summary["dates"].append(value)
        elif d.category in {"drivers_license_number", "possible_identifier", "payment_card", "citizenship_number", "passport_number", "bank_account_number"}:
            summary["id_numbers"].append(value)
        elif d.category in {"person_name", "father_name", "mother_name"}:
            summary["names"].append(value)
        elif d.category == "address":
            summary["addresses"].append(value)
        elif d.category == "password_or_secret":
            summary["password_or_secret_lines"].append(value)
        elif d.category == "face":
            summary["faces"].append(d.bbox)

        if d.skip_reason:
            summary["manual_review_needed"].append({
                "category": d.category,
                "value": value,
                "bbox": d.bbox,
                "reason": d.skip_reason,
            })

    # De-dupe lists while preserving order.
    for k, v in list(summary.items()):
        if isinstance(v, list) and k not in {"manual_review_needed", "faces"}:
            seen = set()
            new = []
            for item in v:
                key = json.dumps(item, ensure_ascii=False, sort_keys=True) if isinstance(item, dict) else str(item)
                if key not in seen:
                    seen.add(key)
                    new.append(item)
            summary[k] = new

    return summary


def default_redaction_categories(
    *,
    redact_dates: bool,
    redact_names: bool,
    redact_addresses: bool,
    redact_faces: bool,
    redact_id_fields: bool,
) -> set[str]:
    cats = {
        "email",
        "url",
        "phone_number",
        "payment_card",
        "password_or_secret",
        "bank_account_number",
        "citizenship_number",
        "drivers_license_number",
        "passport_number",
        "possible_identifier",
    }
    if redact_dates:
        cats.update({"date", "date_component", "date_of_birth", "date_of_issue", "date_of_expiry"})
    if redact_names:
        cats.update({"person_name", "father_name", "mother_name"})
    if redact_addresses:
        cats.update({"address"})
    if redact_faces:
        cats.add("face")
    if redact_id_fields:
        # Broad field-value redaction for ID documents: name, parents, address, gender, ward, etc.
        cats.add("id_field_value")
        cats.add("visible_id_text")
        cats.update({"person_name", "father_name", "mother_name", "address"})
    return cats


# ----------------------------- main processing -----------------------------


def process_image(
    image_path: Path,
    output_dir: Path,
    reader: easyocr.Reader,
    *,
    mode: str,
    strict: bool,
    id_document: bool,
    redact_all_text: bool,
    redact_faces: bool,
    protect_faces: bool,
    allow_large_redaction: bool,
    keep_original: bool,
    ocr_passes: str,
    rotation_ocr: bool,
    redact_dates: bool,
    redact_names: bool,
    redact_addresses: bool,
    redact_id_fields: bool,
    draw_boxes: bool,
    mask_json_values: bool,
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

    out_name = output_name_for(image_path)
    original_copy = ""
    if keep_original:
        original_copy_path = originals_dir / out_name
        shutil.copy2(image_path, original_copy_path)
        original_copy = str(original_copy_path)

    face_boxes = detect_faces(image) if (protect_faces or redact_faces) else []

    # OCR first, then infer document context, then detect/extract.
    ocr_items: List[OCRItem] = []
    for variant_name, variant_img, scale in preprocess_variants(image, ocr_passes):
        try:
            results = run_easyocr(reader, variant_img, rotation_ocr=rotation_ocr)
        except Exception as exc:
            print(f"  OCR variant failed: {variant_name}: {exc}")
            continue
        for poly, text, conf in results:
            text = normalize_text(str(text))
            if not text:
                continue
            bbox = clamp_bbox(polygon_to_bbox(poly, scale=scale), image.shape)
            if bbox_area(bbox) <= 4:
                continue
            ocr_items.append(OCRItem(text=text, confidence=float(conf), bbox=bbox, variant=variant_name))

    ocr_items = dedupe_ocr_items(ocr_items)
    all_text = "\n".join(i.text for i in ocr_items)
    inferred_id_document = bool(id_document or ID_DOCUMENT_HINT_RE.search(all_text))

    detections: List[Detection] = []
    fields: List[ExtractedField] = []

    if redact_all_text:
        for item in ocr_items:
            add_detection(detections, "ocr_text", item.text, item.confidence, item.bbox, "redact-all-text mode", item.text)
    else:
        # Token-level pass.
        for item in ocr_items:
            detect_regex_patterns(
                item.text,
                item.bbox,
                item.confidence,
                detections,
                token_spans=[(0, len(item.text), item.bbox)],
                strict=strict,
                id_document=inferred_id_document,
            )

        # Same-line contextual pass for labels + values.
        line_infos: List[Dict[str, Any]] = []
        for group in make_line_groups(ocr_items):
            line_text, line_bbox, token_spans, avg_conf = join_line(group)
            line_infos.append({"text": line_text, "bbox": line_bbox, "spans": token_spans, "conf": avg_conf})
            if is_oversized_redaction_box(line_bbox, image.shape):
                # Still run extraction, but value-only bboxes will be used where possible.
                pass
            detect_regex_patterns(
                line_text,
                line_bbox,
                avg_conf,
                detections,
                token_spans=token_spans,
                strict=strict,
                id_document=inferred_id_document,
            )
            if inferred_id_document:
                extract_line_fields(line_text, line_bbox, token_spans, avg_conf, fields, detections)
                if redact_id_fields:
                    add_id_field_value_detections(line_text, line_bbox, token_spans, avg_conf, detections)
        if inferred_id_document and redact_id_fields:
            add_wrapped_id_field_redactions(line_infos, detections)
            add_aggressive_visible_id_text_redactions(ocr_items, detections)

    if redact_faces:
        for face_bbox in face_boxes:
            add_detection(detections, "face", "face_region", 0.75, face_bbox, "explicit --redact-faces", "face_region")

    detections = dedupe_detections(detections)
    fields = dedupe_fields(fields)

    redaction_categories = default_redaction_categories(
        redact_dates=redact_dates or inferred_id_document,
        redact_names=redact_names,
        redact_addresses=redact_addresses,
        redact_faces=redact_faces,
        redact_id_fields=redact_id_fields,
    )
    if redact_all_text:
        redaction_categories.add("ocr_text")

    redacted = image.copy()
    for det in detections:
        if det.category not in redaction_categories:
            det.redacted = False
            det.skip_reason = "Extracted only; category is not enabled for redaction."
            continue

        box = expand_bbox(det.bbox, redacted.shape, pad=8)

        if not allow_large_redaction and det.category not in {"face", "ocr_text"} and is_oversized_redaction_box(box, redacted.shape):
            det.redacted = False
            det.skip_reason = "Skipped: oversized OCR box would redact too much of the image."
            continue

        if protect_faces and det.category != "face" and should_skip_for_face_protection(box, face_boxes):
            det.redacted = False
            det.skip_reason = "Skipped: overlaps detected face/photo region. Use --no-protect-faces or --redact-faces if needed."
            continue

        redact_region(redacted, box, mode)
        det.redacted = True
        if draw_boxes:
            cv2.rectangle(redacted, (box[0], box[1]), (box[2], box[3]), (0, 0, 0), 1)

    redacted_path = redacted_dir / out_name.replace(image_path.suffix.lower(), f".redacted{image_path.suffix.lower()}")
    cv2.imwrite(str(redacted_path), redacted)

    structured = build_structured_summary(detections, fields, ocr_items, mask_json=mask_json_values)

    # Detections may contain raw values. Mask if requested.
    det_payload = []
    for d in detections:
        dd = asdict(d)
        if mask_json_values:
            dd["value"] = mask_value(dd["value"])
            dd["source_text"] = mask_value(dd["source_text"])
        det_payload.append(dd)

    field_payload = []
    for f in fields:
        ff = asdict(f)
        if mask_json_values:
            ff["value"] = mask_value(ff["value"])
            ff["source_text"] = mask_value(ff["source_text"])
        field_payload.append(ff)

    payload = {
        "source_image": str(image_path),
        "original_copy": original_copy,
        "redacted_copy": str(redacted_path),
        "mode": mode,
        "strict": strict,
        "id_document_requested": id_document,
        "id_document_inferred": inferred_id_document,
        "redact_all_text": redact_all_text,
        "redact_faces": redact_faces,
        "redact_id_fields": redact_id_fields,
        "protect_faces": protect_faces,
        "allow_large_redaction": allow_large_redaction,
        "ocr_passes": ocr_passes,
        "rotation_ocr": rotation_ocr,
        "redaction_categories": sorted(redaction_categories),
        "detections_count": len(detections),
        "redacted_count": sum(1 for d in detections if d.redacted),
        "skipped_count": sum(1 for d in detections if d.skip_reason and not d.redacted),
        "structured": structured,
        "extracted_fields": field_payload,
        "detections": det_payload,
        "ocr_items": serialise_ocr_items(ocr_items),
    }

    json_path = json_dir / out_name.replace(image_path.suffix.lower(), ".json")
    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    return {
        "image": str(image_path),
        "redacted": str(redacted_path),
        "json": str(json_path),
        "detections_count": payload["detections_count"],
        "redacted_count": payload["redacted_count"],
        "skipped_count": payload["skipped_count"],
        "nepali_text_count": len(structured["nepali_text"]),
        "extracted_fields": fields_to_dict(fields, mask_json=mask_json_values),
        "detections": det_payload,
    }


def iter_images(input_path: Path) -> List[Path]:
    if input_path.is_file():
        return [input_path] if input_path.suffix.lower() in IMAGE_EXTS else []
    if input_path.is_dir():
        return sorted(p for p in input_path.rglob("*") if p.suffix.lower() in IMAGE_EXTS)
    return []


def rel_link(target: str, base_dir: Path) -> str:
    try:
        return Path(target).resolve().relative_to(base_dir.resolve()).as_posix()
    except Exception:
        return target


def write_review_html(output_dir: Path, summaries: List[Dict[str, Any]]) -> None:
    rows = []
    for item in summaries:
        det_preview = json.dumps(item["detections"][:20], indent=2, ensure_ascii=False)
        fields_preview = json.dumps(item.get("extracted_fields", {}), indent=2, ensure_ascii=False)
        redacted_link = rel_link(item["redacted"], output_dir)
        json_link = rel_link(item["json"], output_dir)
        rows.append(f"""
        <tr>
          <td>{html.escape(Path(item['image']).name)}</td>
          <td>{item['detections_count']}</td>
          <td>{item['redacted_count']}</td>
          <td>{item['skipped_count']}</td>
          <td>{item['nepali_text_count']}</td>
          <td><a href="{html.escape(redacted_link)}">redacted image</a></td>
          <td><a href="{html.escape(json_link)}">json</a></td>
          <td><pre>{html.escape(fields_preview)}</pre></td>
          <td><pre>{html.escape(det_preview)}</pre></td>
        </tr>
        """)

    page = f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Document Redaction Review</title>
<style>
body {{ font-family: system-ui, sans-serif; margin: 2rem; }}
table {{ border-collapse: collapse; width: 100%; }}
td, th {{ border: 1px solid #ccc; padding: .5rem; vertical-align: top; }}
pre {{ white-space: pre-wrap; max-height: 280px; overflow: auto; }}
.warning {{ background: #fff3cd; padding: 1rem; border: 1px solid #ffec99; margin-bottom: 1rem; }}
.small {{ color: #555; font-size: .9rem; }}
</style>
</head>
<body>
<h1>Document Redaction Review</h1>
<div class="warning">
Inspect every redacted image before sharing. OCR can miss low-quality text. JSON may contain extracted sensitive values unless <code>--mask-json-values</code> was used.
</div>
<p class="small">Nepali OCR text appears inside each JSON file under <code>structured.nepali_text</code> and <code>ocr_items</code>.</p>
<table>
<thead>
<tr>
<th>Image</th><th>Detections</th><th>Redacted</th><th>Skipped</th><th>Nepali OCR Items</th><th>Redacted Image</th><th>JSON</th><th>Extracted Fields</th><th>Detections Preview</th>
</tr>
</thead>
<tbody>{''.join(rows)}</tbody>
</table>
</body>
</html>"""
    (output_dir / "review.html").write_text(page, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Nepali/English ID document redactor and extractor")
    parser.add_argument("--input", required=True, help="Image file or folder")
    parser.add_argument("--output", required=True, help="Output folder")
    parser.add_argument("--mode", choices=["blur", "black", "pixelate"], default="blur")
    parser.add_argument("--languages", nargs="+", default=["ne", "en"], help="EasyOCR languages, e.g. ne en hi")
    parser.add_argument("--gpu", action="store_true")
    parser.add_argument("--strict", action="store_true", help="Redact generic long IDs/numbers aggressively")
    parser.add_argument("--id-document", action="store_true", help="Treat images as IDs/licenses/passports even if labels are not detected")
    parser.add_argument("--redact-all-text", action="store_true", help="Maximum privacy: redact every OCR text box")
    parser.add_argument("--redact-dates", action="store_true", help="Redact dates even outside inferred ID documents")
    parser.add_argument("--redact-names", action="store_true", help="Also redact detected names")
    parser.add_argument("--redact-addresses", action="store_true", help="Also redact detected addresses")
    parser.add_argument("--redact-id-fields", action="store_true", help="Blur all values after sensitive ID labels: name, address, parents, gender, ward, district, etc.")
    parser.add_argument("--redact-faces", action="store_true", help="Redact detected faces/photos too")
    parser.add_argument("--no-protect-faces", action="store_true", help="Allow redaction boxes to overlap detected faces/photos")
    parser.add_argument("--allow-large-redaction", action="store_true", help="Allow very large OCR boxes to be redacted")
    parser.add_argument("--ocr-passes", choices=["fast", "balanced", "accurate"], default="balanced")
    parser.add_argument("--rotation-ocr", action="store_true", help="Try 90/180/270 OCR rotations; slower")
    parser.add_argument("--no-original-copy", action="store_true", help="Do not save an original copy")
    parser.add_argument("--draw-boxes", action="store_true", help="Draw thin rectangles around redacted regions for debugging")
    parser.add_argument("--mask-json-values", action="store_true", help="Mask values in JSON/review output while still redacting the image")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    images = iter_images(input_path)
    if not images:
        raise SystemExit(f"No supported images found in {input_path}")

    if args.mode == "black":
        print("WARNING: --mode black creates black boxes. Use --mode blur for blurred regions.")
    print(f"Loading OCR model: languages={args.languages}, gpu={args.gpu}")
    reader = easyocr.Reader(args.languages, gpu=args.gpu)

    summaries: List[Dict[str, Any]] = []
    for image_path in images:
        print(f"Processing: {image_path}")
        summary = process_image(
            image_path=image_path,
            output_dir=output_dir,
            reader=reader,
            mode=args.mode,
            strict=args.strict,
            id_document=args.id_document,
            redact_all_text=args.redact_all_text,
            redact_faces=args.redact_faces,
            protect_faces=not args.no_protect_faces,
            allow_large_redaction=args.allow_large_redaction,
            keep_original=not args.no_original_copy,
            ocr_passes=args.ocr_passes,
            rotation_ocr=args.rotation_ocr,
            redact_dates=args.redact_dates,
            redact_names=args.redact_names,
            redact_addresses=args.redact_addresses,
            redact_id_fields=args.redact_id_fields,
            draw_boxes=args.draw_boxes,
            mask_json_values=args.mask_json_values,
        )
        summaries.append(summary)
        print(
            f"  detections: {summary['detections_count']} | "
            f"redacted: {summary['redacted_count']} | "
            f"skipped: {summary['skipped_count']} | "
            f"nepali_text: {summary['nepali_text_count']}"
        )

    write_review_html(output_dir, summaries)
    print(f"Done. Open: {output_dir / 'review.html'}")


if __name__ == "__main__":
    main()
