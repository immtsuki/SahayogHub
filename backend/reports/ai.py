"""
AI processing pipeline for Sahayog Hub reports.

- Document images are redacted via the blur service
- Visual comparison runs against the 50 most recent opposite-type reports
- Text category bonus applied when categories match (reduces false positives)
- Reciprocal matches are written back with select_for_update to avoid races
- Everything runs in a daemon thread so the HTTP response is instant
"""

import base64
import hashlib
import io
import json
import logging
import math
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import Report

logger = logging.getLogger(__name__)

# ── In-process comparison cache (image hash → score) ────────────────────────
# Key: sha256(query_image_first_64_bytes + candidate_image_first_64_bytes)
# Lives as long as the process — cheap RAM usage, big latency win on retries.
_SCORE_CACHE: dict[str, float] = {}
_FEATURE_CACHE: dict[str, dict] = {}
_HEALTH_CACHE: dict[str, tuple[float, bool, str]] = {}
_CACHE_LOCK = threading.Lock()
_MAX_CACHE = 2048  # evict oldest when full
_MAX_IMAGES_PER_REPORT = 2
_LOCAL_FALLBACK_ENGINE = "local_perceptual_fallback_v1"


def _cache_key(q: str, c: str) -> str:
    """
    Stable key for a (query_image, candidate_image) pair.
    For data-URLs we hash actual pixel bytes so every image gets a unique key
    (the first 256 chars of a data-URL are just the identical MIME prefix).
    For hosted URLs we hash the full URL string.
    """
    def _sig(value: str) -> str:
        if value.startswith("data:"):
            # Hash the first ~8 KB of decoded bytes — fast and collision-free
            payload = value.split(",", 1)[-1]
            raw = base64.b64decode(payload[:10924])  # ~8 KB
            return hashlib.sha256(raw).hexdigest()[:20]
        return hashlib.sha256(value.encode()).hexdigest()[:20]

    return f"{_sig(q)}:{_sig(c)}"


def _cache_get(q: str, c: str) -> float | None:
    key = _cache_key(q, c)
    with _CACHE_LOCK:
        return _SCORE_CACHE.get(key)


def _cache_set(q: str, c: str, score: float) -> None:
    key = _cache_key(q, c)
    with _CACHE_LOCK:
        if len(_SCORE_CACHE) >= _MAX_CACHE:
            # Evict the 20% oldest entries
            drop = list(_SCORE_CACHE.keys())[:int(_MAX_CACHE * 0.2)]
            for k in drop:
                del _SCORE_CACHE[k]
        _SCORE_CACHE[key] = score


# ── HTTP helpers ─────────────────────────────────────────────────────────────

def _post_json(url: str, payload: dict, timeout: int | None = None) -> dict:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout or settings.AI_REQUEST_TIMEOUT_SECONDS) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _comparison_timeout_seconds() -> int:
    configured = getattr(settings, "AI_COMPARISON_TIMEOUT_SECONDS", None)
    if configured is not None:
        return int(configured)
    return min(int(settings.AI_REQUEST_TIMEOUT_SECONDS), 8)


def _redaction_timeout_seconds() -> int:
    configured = getattr(settings, "AI_REDACTION_TIMEOUT_SECONDS", None)
    if configured is not None:
        return int(configured)
    return min(int(settings.AI_REQUEST_TIMEOUT_SECONDS), 10)


def _health_timeout_seconds() -> float:
    configured = getattr(settings, "AI_SERVICE_HEALTH_TIMEOUT_SECONDS", None)
    if configured is not None:
        return float(configured)
    return 1.0


def _unique_urls(urls: list[str]) -> list[str]:
    seen, unique = set(), []
    for url in urls:
        url = (url or "").strip()
        if not url or url in seen:
            continue
        seen.add(url)
        unique.append(url)
    return unique


def _redaction_urls() -> list[str]:
    configured = getattr(settings, "AI_REDACTION_URLS", None)
    if configured:
        urls = list(configured)
    else:
        urls = [getattr(settings, "AI_REDACTION_URL", "")]

    expanded = list(urls)
    for url in urls:
        parsed = urllib.parse.urlsplit(url)
        if not parsed.scheme or not parsed.netloc:
            continue
        base = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, "", "", ""))
        expanded.append(f"{base}/redact-image")

    return _unique_urls(expanded)


def _health_url_for(url: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, "/health", "", ""))


def _service_ready(url: str) -> tuple[bool, str]:
    health_url = _health_url_for(url)
    now = time.monotonic()
    with _CACHE_LOCK:
        cached = _HEALTH_CACHE.get(health_url)
    if cached and now - cached[0] < 15:
        return cached[1], cached[2]

    try:
        with urllib.request.urlopen(health_url, timeout=_health_timeout_seconds()) as resp:
            ok = 200 <= resp.status < 300
            message = f"health {resp.status}"
    except Exception as exc:
        ok = False
        message = str(exc)

    with _CACHE_LOCK:
        _HEALTH_CACHE[health_url] = (now, ok, message)
    return ok, message


def _decode_image_bytes(value: str) -> tuple[bytes, str, str]:
    if value.startswith("data:"):
        header, encoded = value.split(",", 1)
        mime = header.split(";", 1)[0].replace("data:", "") or "image/png"
        ext = "jpg" if mime == "image/jpeg" else "png"
        return base64.b64decode(encoded), mime, f"document.{ext}"

    if value.startswith("http://") or value.startswith("https://"):
        with urllib.request.urlopen(value, timeout=5) as resp:
            raw = resp.read()
            mime = resp.headers.get_content_type() or "image/png"
        ext = "jpg" if mime == "image/jpeg" else "png"
        return raw, mime, f"document.{ext}"

    with open(value, "rb") as fh:
        raw = fh.read()
    suffix = value.rsplit(".", 1)[-1].lower() if "." in value else "png"
    mime = "image/jpeg" if suffix in {"jpg", "jpeg"} else "image/png"
    return raw, mime, f"document.{suffix}"


def _data_url_from_bytes(raw: bytes, mime: str) -> str:
    encoded = base64.b64encode(raw).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def _post_multipart_image(url: str, image: str, mode: str) -> dict:
    raw, mime, filename = _decode_image_bytes(image)
    parsed = urllib.parse.urlsplit(url)
    query = urllib.parse.parse_qs(parsed.query)
    query.setdefault("engine", ["auto"])
    query["mode"] = [mode]
    query.setdefault("ocr_passes", ["fast"])
    query_text = urllib.parse.urlencode(query, doseq=True)
    url = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, query_text, parsed.fragment))

    boundary = f"----sahayog-{hashlib.sha256(raw[:1024]).hexdigest()[:16]}"
    body = b"".join([
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode(),
        f"Content-Type: {mime}\r\n\r\n".encode(),
        raw,
        f"\r\n--{boundary}--\r\n".encode(),
    ])
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=_redaction_timeout_seconds()) as resp:
        content = resp.read()
        response_mime = resp.headers.get_content_type() or "image/png"
        return {
            "engine": resp.headers.get("X-Engine-Used") or "blur_ai_for_documentation",
            "sensitive_count": int(resp.headers.get("X-Sensitive-Count") or resp.headers.get("X-Redacted-Count") or 0),
            "redacted_count": int(resp.headers.get("X-Redacted-Count") or 0),
            "redacted_image": _data_url_from_bytes(content, response_mime),
        }


def _redact_with_service(image: str, mode: str = "blur") -> tuple[dict, str]:
    errors = []
    for url in _redaction_urls():
        ready, health_message = _service_ready(url)
        if not ready:
            errors.append(f"{url}: service not ready ({health_message})")
            continue
        try:
            if urllib.parse.urlsplit(url).path.rstrip("/").endswith("/redact-image"):
                return _post_multipart_image(url, image, mode), url
            return _post_json(url, {"image": image, "mode": mode}, timeout=_redaction_timeout_seconds()), url
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, OSError) as exc:
            errors.append(f"{url}: {exc}")
    raise RuntimeError("; ".join(errors) if errors else "No redaction URLs configured.")


# ── Payload builders ─────────────────────────────────────────────────────────

def _public_match_payload(report: Report, score: float | None = None) -> dict:
    image = (report.image_urls or [""])[0]
    return {
        "id":            report.id,
        "report_type":   report.report_type,
        "status":        report.status,
        "subject_type":  report.subject_type,
        "title":         report.title,
        "description":   report.description,
        "category_label": report.category_label,
        "location":      report.location_label,
        "lat":           report.latitude,
        "lng":           report.longitude,
        "image":         image,
        "images":        report.image_urls or [],
        "matchPercent":  int(round(score if score is not None else report.match_percent)),
        "date":          report.reported_at.strftime("%b %d, %Y"),
        "postedAgo":     "Just now",
        "user": {
            "id":     str(report.owner_id or report.id),
            "name":   report.contact_name or "Sahayog User",
            "avatar": report.contact_avatar or f"https://i.pravatar.cc/40?u={report.contact_email or report.id}",
            "email":  report.contact_email,
            "phone":  report.contact_phone,
        },
        "contact": {
            "name":   report.contact_name or "Sahayog User",
            "email":  report.contact_email,
            "phone":  report.contact_phone,
            "avatar": report.contact_avatar or f"https://i.pravatar.cc/40?u={report.contact_email or report.id}",
        },
    }


def _append_match(existing: list, payload: dict) -> list:
    matches = [m for m in (existing or []) if m.get("id") != payload.get("id")]
    matches.insert(0, payload)
    return matches[:5]


def _candidate_image(report: Report) -> str:
    """Always use original (unredacted) images for visual comparison."""
    images = _candidate_images(report)
    return images[0] if images else ""


def _candidate_images(report: Report) -> list[str]:
    """Always use original (unredacted) images for visual comparison."""
    images = report.original_image_urls or report.image_urls or []
    return [img for img in images if img][:_MAX_IMAGES_PER_REPORT]


# ── Text similarity ──────────────────────────────────────────────────────────

def _tokenize(text: str) -> set[str]:
    """Lowercase, strip punctuation, return word set."""
    return set(re.findall(r'\b\w{2,}\b', text.lower()))

_STOP_WORDS = {
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'it', 'is', 'was', 'i', 'my', 'this', 'that', 'near',
    'found', 'lost', 'item', 'report', 'please', 'contact', 'if', 'has',
}

def _text_similarity(title_a: str, desc_a: str, title_b: str, desc_b: str) -> float:
    """
    Jaccard similarity over the union of title + description tokens.
    Title words are weighted 3×, description words 1×.
    Returns [0, 1].
    """
    def weighted_tokens(title: str, desc: str) -> dict[str, float]:
        tokens: dict[str, float] = {}
        for w in _tokenize(title) - _STOP_WORDS:
            tokens[w] = tokens.get(w, 0) + 3.0   # title weight
        for w in _tokenize(desc) - _STOP_WORDS:
            tokens[w] = tokens.get(w, 0) + 1.0   # description weight
        return tokens

    ta = weighted_tokens(title_a, desc_a)
    tb = weighted_tokens(title_b, desc_b)

    if not ta or not tb:
        return 0.0

    # Weighted Jaccard
    keys = set(ta) | set(tb)
    intersection = sum(min(ta.get(k, 0), tb.get(k, 0)) for k in keys)
    union        = sum(max(ta.get(k, 0), tb.get(k, 0)) for k in keys)
    return float(intersection / union) if union > 0 else 0.0


# ── Text category bonus ──────────────────────────────────────────────────────

def _apply_category_bonus(score: float, report_cat: str, candidate_cat: str) -> float:
    """
    Boost score when categories match, penalise when they clearly differ.
    Keeps true positives surfaced and reduces cross-category noise.
    """
    if not report_cat or not candidate_cat:
        return score
    r = report_cat.lower().strip()
    c = candidate_cat.lower().strip()
    if r == c:
        return min(100.0, score * 1.12)       # +12 % for exact category match
    # Broad groups — same group = mild boost
    GROUPS = [
        {"bags_luggage", "backpack", "luggage"},
        {"phone", "electronics", "laptop", "tablet"},
        {"keys", "key"},
        {"wallet", "purse"},
        {"passport", "document", "id card", "certificate"},
        {"dog", "cat", "pet", "animal"},
    ]
    for group in GROUPS:
        if any(g in r for g in group) and any(g in c for g in group):
            return min(100.0, score * 1.06)   # +6 % for same broad group
    return score


def _apply_text_bonus(score: float, report: Report, candidate: Report) -> float:
    similarity = _text_similarity(
        report.title or "",
        report.description or "",
        candidate.title or "",
        candidate.description or "",
    )
    if similarity <= 0:
        return score
    return min(100.0, score + similarity * 18.0)


# Local visual fallback.

def _decode_local_image(value: str):
    try:
        from PIL import Image, ImageOps
    except ImportError as exc:
        raise RuntimeError("Pillow is required for local image comparison fallback.") from exc

    if value.startswith("data:"):
        payload = value.split(",", 1)[-1]
        raw = base64.b64decode(payload)
        image = Image.open(io.BytesIO(raw))
    elif value.startswith("http://") or value.startswith("https://"):
        with urllib.request.urlopen(value, timeout=5) as resp:
            image = Image.open(io.BytesIO(resp.read()))
    else:
        image = Image.open(value)

    return ImageOps.exif_transpose(image).convert("RGB")


def _image_fingerprint(value: str) -> str:
    if value.startswith("data:"):
        payload = value.split(",", 1)[-1]
        raw = base64.b64decode(payload)
        return hashlib.sha256(raw).hexdigest()
    return hashlib.sha256(value.encode()).hexdigest()


def _average_hash(image) -> tuple[int, ...]:
    thumb = image.convert("L").resize((8, 8))
    pixels = list(thumb.getdata())
    avg = sum(pixels) / len(pixels)
    return tuple(1 if px >= avg else 0 for px in pixels)


def _hash_similarity(hash_a: tuple[int, ...], hash_b: tuple[int, ...]) -> float:
    if len(hash_a) != len(hash_b) or not hash_a:
        return 0.0
    distance = sum(1 for a, b in zip(hash_a, hash_b) if a != b)
    return 1.0 - distance / len(hash_a)


def _color_similarity(image_a, image_b) -> float:
    a = list(image_a.resize((16, 16)).getdata())
    b = list(image_b.resize((16, 16)).getdata())
    if len(a) != len(b) or not a:
        return 0.0
    diff = 0
    for pa, pb in zip(a, b):
        diff += abs(pa[0] - pb[0]) + abs(pa[1] - pb[1]) + abs(pa[2] - pb[2])
    max_diff = len(a) * 255 * 3
    return max(0.0, 1.0 - diff / max_diff)


def _color_vector_similarity(vector_a, vector_b) -> float:
    if len(vector_a) != len(vector_b) or not vector_a:
        return 0.0
    diff = 0
    for pa, pb in zip(vector_a, vector_b):
        diff += abs(pa[0] - pb[0]) + abs(pa[1] - pb[1]) + abs(pa[2] - pb[2])
    max_diff = len(vector_a) * 255 * 3
    return max(0.0, 1.0 - diff / max_diff)


def _aspect_similarity(image_a, image_b) -> float:
    ratio_a = image_a.width / max(1, image_a.height)
    ratio_b = image_b.width / max(1, image_b.height)
    if ratio_a <= 0 or ratio_b <= 0:
        return 0.0
    return max(0.0, 1.0 - abs(math.log(ratio_a / ratio_b)))


def _local_image_features(value: str) -> dict:
    key = _image_fingerprint(value)
    with _CACHE_LOCK:
        cached = _FEATURE_CACHE.get(key)
    if cached is not None:
        return cached

    image = _decode_local_image(value)
    features = {
        "hash": _average_hash(image),
        "color": tuple(image.resize((16, 16)).getdata()),
        "aspect": image.width / max(1, image.height),
    }
    with _CACHE_LOCK:
        if len(_FEATURE_CACHE) >= _MAX_CACHE:
            drop = list(_FEATURE_CACHE.keys())[:int(_MAX_CACHE * 0.2)]
            for k in drop:
                del _FEATURE_CACHE[k]
        _FEATURE_CACHE[key] = features
    return features


def _local_visual_similarity(query_image: str, candidate_image: str) -> float:
    if _image_fingerprint(query_image) == _image_fingerprint(candidate_image):
        return 100.0

    query = _local_image_features(query_image)
    candidate = _local_image_features(candidate_image)

    hash_score = _hash_similarity(query["hash"], candidate["hash"])
    color_score = _color_vector_similarity(query["color"], candidate["color"])
    aspect_score = max(0.0, 1.0 - abs(math.log(query["aspect"] / candidate["aspect"])))

    score = (
        0.50 * hash_score
        + 0.35 * color_score
        + 0.15 * aspect_score
    ) * 100.0
    if hash_score < 0.70 and color_score < 0.78:
        score = min(score, 42.0)
    elif hash_score < 0.62:
        score = min(score, 50.0)
    return round(min(100.0, max(0.0, score)), 2)


def _score_locally(query_image: str, candidates: list[dict]) -> tuple[list[dict], list[str]]:
    results, errors = [], []
    for cand in candidates:
        try:
            score = _local_visual_similarity(query_image, cand["image"])
            _cache_set(query_image, cand["image"], score)
            results.append({**cand, "matchPercent": score, "engine": _LOCAL_FALLBACK_ENGINE})
        except Exception as exc:
            errors.append(f"{cand['id']}: {exc}")
            results.append({**cand, "matchPercent": 0.0, "engine": _LOCAL_FALLBACK_ENGINE, "error": str(exc)})
    return results, errors


# ── Document redaction ───────────────────────────────────────────────────────

def _redact_document_images(report: Report) -> None:
    """
    Blur sensitive fields in document reports.
    """
    if report.subject_type != Report.DOCUMENT:
        return

    original = list(report.original_image_urls or report.image_urls or [])
    if not original:
        return

    redacted, results = [], []
    for image in original:
        try:
            result, service_url = _redact_with_service(image, mode="blur")
            sensitive_count = result.get("sensitive_count") or result.get("sensitiveCount") or 0
            redacted_img = result.get("redacted_image") or result.get("redactedImage") or image
            final_img = redacted_img if sensitive_count > 0 else image
            redacted.append(final_img)
            results.append({
                "ok":             True,
                "engine":         result.get("engine") or "unknown",
                "serviceUrl":     service_url,
                "sensitiveCount": sensitive_count,
                "redacted":       sensitive_count > 0,
            })
        except Exception as exc:
            redacted.append(image)
            results.append({"ok": False, "error": str(exc)})

    report.original_image_urls = original
    report.redacted_image_urls = redacted
    report.image_urls = redacted
    report.ai_analysis = {**(report.ai_analysis or {}), "redaction": results}


# ── Visual comparison ─────────────────────────────────────────────────────────

def _compare_against_reports(report: Report) -> list:
    query_images = _candidate_images(report)
    if not query_images:
        return []

    opposite_type = Report.FOUND if report.report_type == Report.LOST else Report.LOST
    max_candidates = int(getattr(settings, "AI_MAX_CANDIDATE_REPORTS", 30))
    candidates_qs = (
        Report.objects
        .exclude(id=report.id)
        .filter(report_type=opposite_type, subject_type=report.subject_type)
        .order_by("-reported_at")[:max_candidates]
    )
    candidates, candidate_map = [], {}
    for c in candidates_qs:
        images = _candidate_images(c)
        if not images:
            continue
        for index, img in enumerate(images):
            candidate_id = f"{c.id}::img{index}"
            candidate_map[candidate_id] = c
            candidates.append({
                "id":           candidate_id,
                "title":        c.title,
                "description":  c.description or "",
                "report_type":  c.report_type,
                "subject_type": c.subject_type,
                "image":        img,
            })

    if not candidates:
        return []

    raw_matches = []
    cached_count = 0
    service_count = 0
    local_count = 0
    local_success_count = 0
    fallback_errors: list[str] = []
    service_error = None
    service_engine = None
    ai_engine_used = False
    service_unavailable = False

    for query_index, query_image in enumerate(query_images):
        uncached = []
        for cand in candidates:
            cached = _cache_get(query_image, cand["image"])
            if cached is not None:
                raw_matches.append({**cand, "matchPercent": cached, "_cached": True})
                cached_count += 1
            else:
                uncached.append(cand)

        if not uncached:
            continue

        if not service_unavailable:
            ready, health_message = _service_ready(settings.AI_COMPARISON_URL)
            if not ready:
                service_unavailable = True
                service_error = f"comparison service not ready ({health_message})"
            else:
                try:
                    result = _post_json(
                        settings.AI_COMPARISON_URL,
                        {
                            "query_image":       query_image,
                            "query_title":       report.title or "",
                            "query_description": report.description or "",
                            "query_report_id":   f"{report.id}::img{query_index}",
                            "candidates":        uncached,
                            "top_k":             10,
                            "threshold":         settings.AI_MATCH_THRESHOLD,
                        },
                        timeout=_comparison_timeout_seconds(),
                    )
                    service_engine = result.get("engine", "unknown")
                    ai_engine_used = bool(result.get("aiEngineUsed", False))
                    for raw in result.get("allScores") or result.get("matches") or []:
                        score = float(raw.get("matchPercent") or 0)
                        cand_id = raw.get("id")
                        cand_obj = next((c for c in uncached if c["id"] == cand_id), None)
                        if cand_obj:
                            _cache_set(query_image, cand_obj["image"], score)
                        raw_matches.append({**raw, "matchPercent": score})
                        service_count += 1
                    continue
                except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, OSError) as exc:
                    service_unavailable = True
                    service_error = str(exc)
                    logger.warning("Comparison service error; using local fallback: %s", exc)

        local_results, local_errors = _score_locally(query_image, uncached)
        raw_matches.extend(local_results)
        local_count += len(local_results)
        local_success_count += len(local_results) - len(local_errors)
        fallback_errors.extend(local_errors[:10])

    engine_parts = []
    if service_count:
        engine_parts.append(service_engine or "comparison_service")
    if local_count:
        engine_parts.append(_LOCAL_FALLBACK_ENGINE)

    report.ai_analysis = {
        **(report.ai_analysis or {}),
        "comparison": {
            "ok":          service_count > 0 or cached_count > 0 or local_success_count > 0,
            "engine":      "+".join(engine_parts) if engine_parts else "none",
            "aiEngineUsed": ai_engine_used,
            "checked":     len({candidate.id for candidate in candidate_map.values()}),
            "checkedPairs": len(query_images) * len(candidates),
            "cachedSkips": cached_count,
            "serviceScores": service_count,
            "localScores": local_count,
            "localSuccesses": local_success_count,
            "serviceError": service_error,
            "fallbackErrors": fallback_errors,
            "processedAt": datetime.utcnow().isoformat() + "Z",
        },
    }

    # Apply text/category boosts only after a candidate has enough visual
    # evidence. Otherwise common words can rescue an unrelated nearest neighbor.
    best_by_report: dict[str, dict] = {}
    visual_floor = float(getattr(settings, "AI_VISUAL_MATCH_THRESHOLD", settings.AI_MATCH_THRESHOLD))
    for raw in raw_matches:
        candidate = candidate_map.get(raw.get("id"))
        if not candidate:
            continue
        visual_score = float(raw.get("matchPercent") or 0)
        if visual_score < visual_floor:
            continue
        boosted_score = _apply_text_bonus(visual_score, report, candidate)
        boosted_score = _apply_category_bonus(
            boosted_score,
            report.category_label or report.category or "",
            candidate.category_label or candidate.category or "",
        )
        if boosted_score < settings.AI_MATCH_THRESHOLD:
            continue
        payload = _public_match_payload(candidate, boosted_score)
        previous = best_by_report.get(candidate.id)
        if not previous or payload["matchPercent"] > previous["matchPercent"]:
            best_by_report[candidate.id] = payload

    matches = list(best_by_report.values())
    matches.sort(key=lambda m: m["matchPercent"], reverse=True)
    return matches[:5]


# ── Core pipeline ─────────────────────────────────────────────────────────────

def _run_ai_pipeline(report_id: str) -> None:
    """
    Runs the full AI pipeline for a saved report.
    Called in a background thread — opens a fresh DB connection.
    """
    # Django DB connections are thread-local — must reset in new thread
    from django.db import close_old_connections
    close_old_connections()

    try:
        report = Report.objects.get(id=report_id)
    except Report.DoesNotExist:
        logger.warning("process_report_ai: report %s not found", report_id)
        return

    _redact_document_images(report)
    matches = _compare_against_reports(report)

    report.ai_matches = matches
    if matches:
        report.match_percent = matches[0]["matchPercent"]
    else:
        report.match_percent = 0
    report.ai_status = "matched" if matches else "processed"
    report.ai_processed_at = timezone.now()
    report.save(update_fields=[
        "image_urls", "original_image_urls", "redacted_image_urls",
        "ai_matches", "ai_analysis", "ai_status", "ai_processed_at",
        "match_percent", "updated_at",
    ])

    # Write reciprocal matches using select_for_update to avoid race conditions
    for match in matches:
        try:
            with transaction.atomic():
                matched_report = (
                    Report.objects
                    .select_for_update()
                    .get(id=match["id"])
                )
                matched_report.ai_matches = _append_match(
                    matched_report.ai_matches,
                    _public_match_payload(report, match["matchPercent"]),
                )
                matched_report.read = False
                matched_report.ai_status = "matched"
                matched_report.ai_processed_at = timezone.now()
                matched_report.save(update_fields=[
                    "ai_matches", "read", "ai_status", "ai_processed_at", "updated_at",
                ])
        except Report.DoesNotExist:
            continue
        except Exception as exc:
            logger.exception("Failed writing reciprocal match for %s: %s", match["id"], exc)


def process_report_ai(report: Report) -> None:
    """
    Spawn a daemon thread so the HTTP 201 response returns instantly.
    The AI pipeline runs in the background.
    """
    t = threading.Thread(target=_run_ai_pipeline, args=(report.id,), daemon=True)
    t.start()
