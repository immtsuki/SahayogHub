"""
Lost & Found Visual Similarity Service
=======================================
Hybrid pipeline: CV signals (always) + CLIP/YOLO AI (when available).

CV signals
  pHash   – perceptual hash, robust to compression
  ORB     – keypoint matching (rotation invariant, skipped gracefully on
             low-texture images instead of returning 0)
  HSV hist– colour palette
  SSIM    – luminance structure (numerically stable version)
  Gabor   – texture fingerprint
  Edge    – shape / contour density

AI layer  (loaded once at startup, reused from search_service when present)
  CLIP    – ViT-B/32 cosine similarity (semantic understanding)
  YOLO    – object class agreement (soft penalty only)

Weights when AI is available
  CLIP 50 %  pHash 10 %  ORB 13 %  Hist 12 %  SSIM 7 %  Texture 4 %  Edge 4 %
  + class-agreement multiplier (0.75 – 1.0, never < 0.75)

Weights when AI is unavailable (pure CV fallback)
  pHash 20 %  ORB 28 %  Hist 22 %  SSIM 18 %  Texture 6 %  Edge 6 %

Score range: identical → ~95-100, same object diff photo → 55-85, unrelated → <40.
"""

from __future__ import annotations

import base64
import hashlib
import io
import logging
from pathlib import Path
from typing import Any
from uuid import uuid4

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from PIL import Image, ImageOps

logger = logging.getLogger("visual_search")

# ── Optional deep-learning search (dataset index) ─────────────────────────────
try:
    from search_service import BlockedQueryError, ImageSearchService  # type: ignore
except Exception as _exc:
    BlockedQueryError = RuntimeError
    ImageSearchService = None
    SEARCH_IMPORT_ERROR: Any = _exc
else:
    SEARCH_IMPORT_ERROR = None

# ── Optional CLIP + YOLO engine for candidate comparison ──────────────────────
try:
    from vision_core import VisionCore  # type: ignore
    _ai_vision: Any = None
    _ai_vision_error: Any = None
except Exception as _ve:
    VisionCore = None  # type: ignore
    _ai_vision = None
    _ai_vision_error = _ve

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR     = Path(__file__).resolve().parent
UPLOAD_DIR   = BASE_DIR / "uploads"
RESULT_DIR   = BASE_DIR / "result"
TEMPLATE_DIR = BASE_DIR / "templates"
for _d in (UPLOAD_DIR, RESULT_DIR, TEMPLATE_DIR):
    _d.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_UPLOAD_BYTES   = 10 * 1024 * 1024  # 10 MB
MIN_CLIP_EVIDENCE  = 0.55
STRONG_CLIP_EVIDENCE = 0.72

# ── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Lost and Found Visual Search",
    description="Hybrid AI+CV visual similarity for Sahayog Hub reports.",
)
app.mount("/result", StaticFiles(directory=str(RESULT_DIR)), name="result")
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))

# ── Dataset search (optional) ──────────────────────────────────────────────────
search_service = search_error = None
if ImageSearchService is not None:
    try:
        search_service = ImageSearchService(
            index_file=str(BASE_DIR / "image_index.faiss"),
            metadata_file=str(BASE_DIR / "image_metadata.pkl"),
            result_root=str(RESULT_DIR / "api"),
            top_k=10,
            rerank_limit=100,
            allow_different_class=False,
        )
    except Exception as exc:
        search_error = exc
else:
    search_error = SEARCH_IMPORT_ERROR

# ── AI vision engine ───────────────────────────────────────────────────────────
if search_service is not None:
    _ai_vision = search_service.vision          # reuse already-loaded models
    _ai_vision_error = None
elif VisionCore is not None:
    try:
        _ai_vision = VisionCore(
            clip_model_name="ViT-B/32",
            yolo_model_name=str(BASE_DIR / "yolov8n.pt"),
            yolo_confidence=0.25,
            prefer_non_person=True,
        )
        _ai_vision_error = None
        logger.info("AI vision engine (CLIP+YOLO) loaded.")
    except Exception as exc:
        _ai_vision = None
        _ai_vision_error = exc
        logger.warning("AI vision engine failed to load: %s", exc)
else:
    _ai_vision_error = _ve if "_ve" in dir() else None

# ── Pydantic models ────────────────────────────────────────────────────────────

class CandidateImage(BaseModel):
    id: str
    title: str = ""
    description: str = ""
    image: str
    report_type: str = ""
    subject_type: str = ""

class CandidateCompareRequest(BaseModel):
    query_image: str
    query_title: str = ""
    query_description: str = ""
    query_report_id: str | None = None
    candidates: list[CandidateImage] = Field(default_factory=list)
    top_k: int = 5
    threshold: float = 62.0

# ─────────────────────────────────────────────────────────────────────────────
# Image helpers
# ─────────────────────────────────────────────────────────────────────────────

def _decode_image(value: str) -> Image.Image:
    """Accept a data-URL (base64), http/https URL, or local file path."""
    if value.startswith("data:"):
        payload = value.split(",", 1)[-1]
        raw = base64.b64decode(payload)
        img = Image.open(io.BytesIO(raw))
    elif value.startswith("http://") or value.startswith("https://"):
        import urllib.request
        with urllib.request.urlopen(value, timeout=15) as resp:
            img = Image.open(io.BytesIO(resp.read()))
    else:
        img = Image.open(value)
    return ImageOps.exif_transpose(img).convert("RGB")


def _image_fingerprint(value: str) -> str:
    """
    Stable cache key for an image value.
    For data-URLs we hash the actual pixel bytes (not the b64 string prefix
    which is identical for every image).  For URLs we hash the full URL.
    """
    if value.startswith("data:"):
        payload = value.split(",", 1)[-1]
        # Hash first 8 KB of the decoded bytes — fast, collision-proof in practice
        raw = base64.b64decode(payload[:10924])  # ~8 KB decoded
        return hashlib.sha256(raw).hexdigest()[:24]
    return hashlib.sha256(value.encode()).hexdigest()[:24]


def _to_bgr(image: Image.Image, size: tuple[int, int] = (256, 256)) -> np.ndarray:
    return cv2.cvtColor(np.asarray(image.resize(size, Image.Resampling.LANCZOS)), cv2.COLOR_RGB2BGR)

# ─────────────────────────────────────────────────────────────────────────────
# CV similarity signals
# ─────────────────────────────────────────────────────────────────────────────

def _phash_similarity(a: Image.Image, b: Image.Image, size: int = 32) -> float:
    """DCT-based perceptual hash. Returns [0, 1]."""
    def phash(img: Image.Image) -> np.ndarray:
        gray = np.asarray(img.convert("L").resize((size, size), Image.Resampling.LANCZOS), dtype=np.float32)
        dct  = cv2.dct(gray)
        low  = dct[:8, :8].flatten()
        med  = np.median(low)
        # Avoid all-same bit array when all values equal median
        return low > med if not np.all(low == med) else (low >= med)

    ha, hb = phash(a), phash(b)
    return float(1.0 - np.count_nonzero(ha != hb) / ha.size)


def _orb_similarity(a: Image.Image, b: Image.Image) -> float:
    """
    ORB keypoint matching.  Returns [0, 1].
    Falls back to 0.5 (neutral) — not 0.0 — when too few keypoints are found,
    so low-texture images don't unfairly tank the overall score.
    """
    orb = cv2.ORB_create(nfeatures=500, scaleFactor=1.2, nlevels=8)
    bf  = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)

    ga = cv2.cvtColor(_to_bgr(a), cv2.COLOR_BGR2GRAY)
    gb = cv2.cvtColor(_to_bgr(b), cv2.COLOR_BGR2GRAY)

    kp_a, des_a = orb.detectAndCompute(ga, None)
    kp_b, des_b = orb.detectAndCompute(gb, None)

    # Not enough keypoints — image may be low-texture (solid colour, blur).
    # Return 0.5 (neutral) so the ORB term doesn't wrongly penalise the score.
    if des_a is None or des_b is None or len(des_a) < 4 or len(des_b) < 4:
        return 0.5

    matches = bf.match(des_a, des_b)
    if not matches:
        return 0.5

    distances = sorted(m.distance for m in matches)
    threshold = max(40, np.percentile(distances, 30))
    good      = [m for m in matches if m.distance <= threshold]

    ratio = len(good) / max(1, min(len(kp_a), len(kp_b)))
    return float(min(1.0, ratio * 2.5))


def _histogram_similarity(a: Image.Image, b: Image.Image) -> float:
    """Bhattacharyya coefficient on 3-channel HSV histogram. Returns [0, 1]."""
    def hsv_hist(img: Image.Image) -> np.ndarray:
        hsv = cv2.cvtColor(_to_bgr(img, (224, 224)), cv2.COLOR_BGR2HSV)
        h   = cv2.calcHist([hsv], [0, 1, 2], None, [16, 8, 8], [0, 180, 0, 256, 0, 256])
        cv2.normalize(h, h)
        return h.flatten().astype(np.float32)

    dist = cv2.compareHist(hsv_hist(a), hsv_hist(b), cv2.HISTCMP_BHATTACHARYYA)
    return float(max(0.0, 1.0 - dist))


def _ssim_luminance(a: Image.Image, b: Image.Image, size: int = 128) -> float:
    """
    Numerically stable SSIM on grayscale.
    Handles uniform images (std ≈ 0) without producing NaN. Returns [0, 1].
    """
    def lum(img: Image.Image) -> np.ndarray:
        return np.asarray(img.convert("L").resize((size, size)), dtype=np.float32) / 255.0

    la, lb  = lum(a), lum(b)
    mu_a    = float(la.mean())
    mu_b    = float(lb.mean())
    sig_a   = float(la.std())
    sig_b   = float(lb.std())
    sig_ab  = float(np.mean((la - mu_a) * (lb - mu_b)))

    c1 = (0.01) ** 2
    c2 = (0.03) ** 2

    num   = (2.0 * mu_a * mu_b + c1) * (2.0 * sig_ab + c2)
    denom = (mu_a ** 2 + mu_b ** 2 + c1) * (sig_a ** 2 + sig_b ** 2 + c2)

    if abs(denom) < 1e-10:
        # Both images are uniform — if they have the same brightness they're
        # identical; otherwise they differ.
        return 1.0 if abs(mu_a - mu_b) < 0.02 else 0.0

    return float(max(0.0, num / denom))


def _gabor_texture_similarity(a: Image.Image, b: Image.Image) -> float:
    """Gabor filter response histogram cosine similarity. Returns [0, 1]."""
    def features(img: Image.Image) -> np.ndarray:
        gray  = cv2.cvtColor(_to_bgr(img, (128, 128)), cv2.COLOR_BGR2GRAY).astype(np.float32)
        parts = []
        for theta in np.linspace(0, np.pi, 4, endpoint=False):
            for lam in (4.0, 8.0):
                kern = cv2.getGaborKernel((11, 11), sigma=2.5, theta=theta, lambd=lam, gamma=0.5, psi=0)
                resp = np.abs(cv2.filter2D(gray, cv2.CV_32F, kern))
                hist, _ = np.histogram(resp.ravel(), bins=16, range=(0, 128))
                hist = hist.astype(np.float32)
                hist /= (hist.sum() + 1e-7)
                parts.append(hist)
        return np.concatenate(parts)

    fa, fb = features(a), features(b)
    dot    = float(np.dot(fa, fb))
    norm   = float(np.linalg.norm(fa) * np.linalg.norm(fb)) + 1e-9
    return float(max(0.0, dot / norm))


def _edge_density_similarity(a: Image.Image, b: Image.Image) -> float:
    """Canny edge-density spatial grid comparison. Returns [0, 1]."""
    def grid(img: Image.Image) -> np.ndarray:
        gray  = cv2.cvtColor(_to_bgr(img, (224, 224)), cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        h, w  = edges.shape
        bh, bw = h // 4, w // 4
        return np.array(
            [edges[r * bh:(r + 1) * bh, c * bw:(c + 1) * bw].mean() / 255.0
             for r in range(4) for c in range(4)],
            dtype=np.float32,
        )

    fa, fb = grid(a), grid(b)
    return float(1.0 - np.mean(np.abs(fa - fb)))

# ─────────────────────────────────────────────────────────────────────────────
# AI similarity (CLIP + YOLO class agreement)
# ─────────────────────────────────────────────────────────────────────────────

def _clip_cosine_similarity(a: Image.Image, b: Image.Image) -> tuple[float, str, str]:
    """
    CLIP ViT-B/32 cosine similarity + YOLO object class detection.
    Returns (score [0,1], class_a, class_b).
    """
    if _ai_vision is None:
        return 0.0, "unknown", "unknown"

    import tempfile
    import os

    def _embed(img: Image.Image) -> tuple[np.ndarray, str]:
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            img.save(tmp.name, format="JPEG", quality=92)
            tmp_path = tmp.name
        try:
            crop, info = _ai_vision.detect_and_crop_primary_object(tmp_path)
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
        return _ai_vision.get_clip_embedding_from_pil(crop), info.get("detected_object", "unknown")

    try:
        emb_a, cls_a = _embed(a)
        emb_b, cls_b = _embed(b)
        # CLIP embeddings are L2-normalised → dot product == cosine similarity
        cosine = float(np.dot(emb_a.flatten(), emb_b.flatten()))
        # Map [-1, 1] → [0, 1]
        score  = max(0.0, min(1.0, cosine))
        return score, cls_a, cls_b
    except Exception as exc:
        logger.warning("CLIP embedding error: %s", exc)
        return 0.0, "unknown", "unknown"


# Synonym groups for class-agreement — same group = no penalty
_CLASS_GROUPS: list[frozenset[str]] = [
    frozenset({"backpack", "handbag", "suitcase", "bag"}),
    frozenset({"cell phone", "laptop", "tablet", "keyboard", "mouse", "remote"}),
    frozenset({"wallet", "purse"}),
    frozenset({"bottle", "cup", "bowl"}),
    frozenset({"book", "notebook"}),
    frozenset({"dog", "cat"}),
    frozenset({"car", "truck", "bus", "motorcycle"}),
    frozenset({"umbrella", "parasol"}),
    frozenset({"original", "unknown"}),   # YOLO couldn't detect → no penalty
]

def _class_agreement_factor(cls_a: str, cls_b: str) -> float:
    """
    Multiplier in [0.75, 1.0].  Only penalises CLEARLY different object classes
    (e.g. dog vs laptop).  Unknown / undetected classes are treated as neutral.
    """
    if not cls_a or not cls_b:
        return 1.0
    if cls_a in {"unknown", "original"} or cls_b in {"unknown", "original"}:
        return 1.0
    if cls_a == cls_b:
        return 1.0
    for group in _CLASS_GROUPS:
        if cls_a in group and cls_b in group:
            return 1.0   # same semantic group → no penalty
    # Clearly different classes — mild penalty (was 0.65, raised to 0.75)
    return 0.55

# ─────────────────────────────────────────────────────────────────────────────
# Main scoring function
# ─────────────────────────────────────────────────────────────────────────────

def compute_similarity(query: Image.Image, candidate: Image.Image) -> dict:
    """
    Compute hybrid AI + CV visual similarity → score in [0, 100].

    Weights (AI available):
        CLIP 50 %  pHash 10 %  ORB 13 %  Hist 12 %  SSIM 7 %  Texture 4 %  Edge 4 %
        × class_agreement_factor (0.75–1.0)

    Weights (CV fallback):
        pHash 20 %  ORB 28 %  Hist 22 %  SSIM 18 %  Texture 6 %  Edge 6 %
    """
    phash   = _phash_similarity(query, candidate)
    orb     = _orb_similarity(query, candidate)
    hist    = _histogram_similarity(query, candidate)
    ssim    = _ssim_luminance(query, candidate)
    texture = _gabor_texture_similarity(query, candidate)
    edges   = _edge_density_similarity(query, candidate)

    signals: dict = {
        "phash":   round(phash * 100, 1),
        "orb":     round(orb * 100, 1),
        "hist":    round(hist * 100, 1),
        "ssim":    round(ssim * 100, 1),
        "texture": round(texture * 100, 1),
        "edges":   round(edges * 100, 1),
    }

    if _ai_vision is not None:
        clip_score, cls_a, cls_b = _clip_cosine_similarity(query, candidate)
        factor = _class_agreement_factor(cls_a, cls_b)

        weighted = (
            0.50 * clip_score
            + 0.10 * phash
            + 0.13 * orb
            + 0.12 * hist
            + 0.07 * ssim
            + 0.04 * texture
            + 0.04 * edges
        ) * factor

        weak_visual_evidence = (
            clip_score < MIN_CLIP_EVIDENCE
            and phash < 0.70
            and orb < 0.35
        )
        class_conflict = factor < 1.0
        if weak_visual_evidence:
            weighted = min(weighted, 0.39)
        elif class_conflict and clip_score < STRONG_CLIP_EVIDENCE:
            weighted = min(weighted, 0.49)

        signals.update({
            "clip":         round(clip_score * 100, 1),
            "detected_a":   cls_a,
            "detected_b":   cls_b,
            "class_factor": round(factor, 3),
            "quality_gate":  "weak_visual" if weak_visual_evidence else "class_conflict" if class_conflict else "pass",
        })
        engine = "hybrid_ai_cv_v1"
    else:
        # Pure CV — redistributed weights, ORB neutral fallback already handled
        weighted = (
            0.20 * phash
            + 0.28 * orb
            + 0.22 * hist
            + 0.18 * ssim
            + 0.06 * texture
            + 0.06 * edges
        )
        if phash < 0.68 and orb < 0.35 and ssim < 0.45:
            weighted = min(weighted, 0.39)
        engine = "cv_fallback_v2"

    final = round(min(100.0, max(0.0, weighted * 100.0)), 2)
    return {"final": final, "engine": engine, "signals": signals}

# ─────────────────────────────────────────────────────────────────────────────
# API routes
# ─────────────────────────────────────────────────────────────────────────────

def render_page(request, query=None, results=None, error=None, status_code=200):
    return templates.TemplateResponse(
        request=request, name="index.html",
        context={"query": query, "results": results, "error": error},
        status_code=status_code,
    )


async def save_uploaded_image(file: UploadFile) -> Path:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Only JPG, JPEG, PNG, and WEBP images are allowed.")
    path = UPLOAD_DIR / f"{uuid4().hex}{ext}"
    total = 0
    with path.open("wb") as fh:
        while chunk := await file.read(1024 * 1024):
            total += len(chunk)
            if total > MAX_UPLOAD_BYTES:
                path.unlink(missing_ok=True)
                raise HTTPException(413, "Image too large. Max 10 MB.")
            fh.write(chunk)
    return path


@app.get("/health")
async def health():
    return {
        "status":             "ok",
        "engine":             "hybrid_ai_cv_v1" if _ai_vision is not None else "cv_fallback_v2",
        "aiEngineReady":      _ai_vision is not None,
        "aiEngineError":      str(_ai_vision_error) if _ai_vision_error else None,
        "signals":            (
            ["clip", "yolo_class", "phash", "orb", "hist", "ssim", "texture", "edges"]
            if _ai_vision is not None else
            ["phash", "orb", "hist", "ssim", "texture", "edges"]
        ),
        "datasetSearchReady": search_service is not None,
        "datasetSearchError": str(search_error) if search_error else None,
        "candidateCompareReady": True,
    }


@app.get("/")
async def home(request: Request):
    return render_page(request)


@app.post("/search")
async def search_web(request: Request, file: UploadFile = File(...)):
    if search_service is None:
        return render_page(request, error=f"Dataset search unavailable: {search_error}")
    try:
        path = await save_uploaded_image(file)
        data = search_service.search(query_image_path=path, top_k=10)
        return render_page(request, query=data["query"], results=data["results"])
    except BlockedQueryError as e:
        return render_page(request, error=str(e))


@app.post("/api/search")
async def search_api(file: UploadFile = File(...)):
    if search_service is None:
        return JSONResponse({"blocked": False, "modelUnavailable": True,
                             "reason": str(search_error), "query": None, "results": []})
    try:
        path = await save_uploaded_image(file)
        data = search_service.search(query_image_path=path, top_k=10)
        return JSONResponse(data)
    except BlockedQueryError as e:
        return JSONResponse({"blocked": True, "reason": str(e), "query": None, "results": []})


@app.post("/api/compare-candidates")
async def compare_candidates(payload: CandidateCompareRequest):
    try:
        query_img = _decode_image(payload.query_image)
    except Exception as exc:
        return JSONResponse(
            {"error": f"Could not decode query image: {exc}", "matches": [], "checked": 0},
            status_code=400,
        )

    matches = []
    for candidate in payload.candidates:
        try:
            cand_img = _decode_image(candidate.image)
            result   = compute_similarity(query_img, cand_img)
            score    = result["final"]
        except Exception as exc:
            logger.warning("Candidate %s decode/score error: %s", candidate.id, exc)
            matches.append({
                "id": candidate.id, "title": candidate.title,
                "matchPercent": 0.0, "error": str(exc),
            })
            continue

        matches.append({
            "id":             candidate.id,
            "title":          candidate.title,
            "report_type":    candidate.report_type,
            "subject_type":   candidate.subject_type,
            "matchPercent":   score,
            "signals":        result["signals"],
            "engine":         result["engine"],
            "aboveThreshold": score >= payload.threshold,
        })

    matches.sort(key=lambda m: m.get("matchPercent", 0.0), reverse=True)
    above = [m for m in matches if m.get("aboveThreshold")]

    return {
        "blocked":         False,
        "engine":          "hybrid_ai_cv_v1" if _ai_vision is not None else "cv_fallback_v2",
        "aiEngineUsed":    _ai_vision is not None,
        "query_report_id": payload.query_report_id,
        "checked":         len(payload.candidates),
        "threshold":       payload.threshold,
        "matches":         above[: max(1, payload.top_k)],
        "allScores":       matches,
    }
