"""
face_core.py — Face Segmentation + Recognition Pipeline
SahayogHub · Missing Persons Module

Pipeline per image:
    1. MediaPipe Face Detection  → tight face bounding box
    2. Head-region crop          → eliminates most background before segmentation
    3. MediaPipe Selfie Seg      → binary mask, zeros out non-person pixels
    4. DeepFace (ArcFace)        → 512-d identity embedding from isolated face
    5. FAISS cosine search       → ranked missing person matches

Designed to slot alongside vision_core.VisionCore without coupling.
Run build_face_index.py to index a dataset, then search_face.py to query.
"""

import hashlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import cv2
import mediapipe as mp
import numpy as np
from deepface import DeepFace
from PIL import Image, ImageOps


# ──────────────────────────────────────────────
#  Constants
# ──────────────────────────────────────────────

FACE_EMBEDDING_DIM = 512          # ArcFace output dimension
MIN_FACE_PIXEL_SIZE = 40          # faces smaller than this (px) are skipped
SEGMENTATION_THRESHOLD = 0.6      # MediaPipe confidence: person vs background
HEAD_PAD_TOP_RATIO = 0.35         # extra headroom above detected face bbox
HEAD_PAD_SIDE_RATIO = 0.20        # side padding to capture ears
HEAD_PAD_BOTTOM_RATIO = 0.10      # chin clearance

DEEPFACE_MODEL = "ArcFace"        # best accuracy/speed for identity matching
DEEPFACE_BACKEND = "retinaface"   # most robust face detector inside DeepFace


# ──────────────────────────────────────────────
#  Result containers
# ──────────────────────────────────────────────

@dataclass
class FaceDetectionResult:
    """Output from a single image through the full segmentation pipeline."""

    success: bool

    # The final segmented face image (black background, face pixels only).
    # None when success=False.
    segmented_face: Optional[Image.Image] = None

    # 512-d ArcFace embedding, L2-normalised. None when success=False.
    embedding: Optional[np.ndarray] = None

    # Bounding box of detected face in original image coordinates.
    face_bbox: Optional[list] = None          # [x1, y1, x2, y2]

    # MediaPipe face detection confidence (0.0–1.0).
    detection_confidence: float = 0.0

    # Ratio of face pixels that survived segmentation (0.0–1.0).
    # Low values (<0.3) often mean the segmentation masked the face itself.
    mask_coverage: float = 0.0

    # Human-readable failure reason when success=False.
    error: Optional[str] = None

    # Hash of the embedding for deduplication (not for identity matching).
    embedding_hash: Optional[str] = None


@dataclass
class FaceSearchResult:
    """One ranked result from a FAISS search."""

    rank: int
    image_path: str
    person_id: Optional[str]        # label / filename stem used as ID
    similarity_score: float         # 0.0–1.0, higher = more similar
    similarity_pct: float           # score × 100, rounded to 2 dp
    detection_confidence: float
    face_bbox: Optional[list]
    metadata: dict = field(default_factory=dict)


# ──────────────────────────────────────────────
#  Helpers
# ──────────────────────────────────────────────

def open_image_correctly(image_path) -> Image.Image:
    """Open image, correct EXIF orientation, convert to RGB."""
    image = Image.open(image_path)
    image = ImageOps.exif_transpose(image)
    return image.convert("RGB")


def pil_to_bgr(image: Image.Image) -> np.ndarray:
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


def bgr_to_pil(image_bgr: np.ndarray) -> Image.Image:
    return Image.fromarray(cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB))


def hash_embedding(embedding: np.ndarray) -> str:
    return hashlib.sha256(embedding.tobytes()).hexdigest()[:16]


def clamp(value, lo, hi):
    return max(lo, min(hi, value))


# ──────────────────────────────────────────────
#  Core class
# ──────────────────────────────────────────────

class FaceCore:
    """
    Stateful pipeline: loads all models once, reused across many images.

    Usage:
        core = FaceCore()
        result = core.process(image_path)
        if result.success:
            # use result.embedding, result.segmented_face
    """

    def __init__(
        self,
        segmentation_threshold: float = SEGMENTATION_THRESHOLD,
        min_face_size: int = MIN_FACE_PIXEL_SIZE,
        deepface_model: str = DEEPFACE_MODEL,
        deepface_backend: str = DEEPFACE_BACKEND,
    ):
        self.segmentation_threshold = segmentation_threshold
        self.min_face_size = min_face_size
        self.deepface_model = deepface_model
        self.deepface_backend = deepface_backend

        print("Loading MediaPipe Face Detection...")
        self._mp_face_detection = mp.solutions.face_detection
        self._face_detector = self._mp_face_detection.FaceDetection(
            model_selection=1,           # model 1 = full-range (up to 5m)
            min_detection_confidence=0.5,
        )

        print("Loading MediaPipe Selfie Segmentation...")
        self._mp_selfie_seg = mp.solutions.selfie_segmentation
        self._segmenter = self._mp_selfie_seg.SelfieSegmentation(
            model_selection=1,           # model 1 = landscape (more accurate)
        )

        # DeepFace loads its model lazily on first call.
        # We trigger that here so the first real image is not slow.
        print("Warming up DeepFace / ArcFace...")
        self._warmup_deepface()

        print("FaceCore ready.")

    # ──────────────────────────────────────────
    #  Public interface
    # ──────────────────────────────────────────

    def process(self, image_path) -> FaceDetectionResult:
        """
        Full pipeline: open → detect → crop → segment → embed.

        Returns FaceDetectionResult with success=False and a human-readable
        error string if any stage fails. Never raises.
        """
        image_path = Path(image_path)

        try:
            original = open_image_correctly(image_path)
        except Exception as e:
            return FaceDetectionResult(success=False, error=f"Cannot open image: {e}")

        # Stage 1 — MediaPipe face detection on full image.
        face_bbox, detection_confidence = self._detect_face_bbox(original)

        if face_bbox is None:
            return FaceDetectionResult(
                success=False,
                error="No face detected by MediaPipe.",
            )

        x1, y1, x2, y2 = face_bbox
        face_w = x2 - x1
        face_h = y2 - y1

        if face_w < self.min_face_size or face_h < self.min_face_size:
            return FaceDetectionResult(
                success=False,
                error=(
                    f"Face too small ({face_w}×{face_h}px). "
                    f"Minimum is {self.min_face_size}px."
                ),
                face_bbox=face_bbox,
                detection_confidence=detection_confidence,
            )

        # Stage 2 — Padded head crop.
        # Expand the tight face bbox to include forehead, ears, chin.
        # This gives the segmenter enough context without the full image background.
        head_crop, head_offset = self._crop_head_region(original, face_bbox)

        # Stage 3 — Selfie segmentation on the head crop only.
        segmented, mask_coverage = self._segment_person(head_crop)

        if mask_coverage < 0.05:
            return FaceDetectionResult(
                success=False,
                error=(
                    f"Segmentation masked the face (coverage={mask_coverage:.2f}). "
                    "Image may be too dark or face is occluded."
                ),
                face_bbox=face_bbox,
                detection_confidence=detection_confidence,
                mask_coverage=mask_coverage,
            )

        # Stage 4 — DeepFace ArcFace embedding from the clean segmented crop.
        embedding, embed_error = self._get_embedding(segmented)

        if embedding is None:
            return FaceDetectionResult(
                success=False,
                error=f"DeepFace embedding failed: {embed_error}",
                face_bbox=face_bbox,
                detection_confidence=detection_confidence,
                mask_coverage=mask_coverage,
                segmented_face=segmented,
            )

        return FaceDetectionResult(
            success=True,
            segmented_face=segmented,
            embedding=embedding,
            face_bbox=face_bbox,
            detection_confidence=detection_confidence,
            mask_coverage=mask_coverage,
            embedding_hash=hash_embedding(embedding),
        )

    def get_embedding_from_pil(self, image: Image.Image) -> FaceDetectionResult:
        """
        Same pipeline but accepts an already-opened PIL image.
        Useful when the caller already has the image in memory.
        """
        import tempfile
        import os

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            image.save(tmp.name)
            tmp_path = tmp.name

        try:
            return self.process(tmp_path)
        finally:
            os.unlink(tmp_path)

    # ──────────────────────────────────────────
    #  Stage implementations
    # ──────────────────────────────────────────

    def _detect_face_bbox(
        self,
        image: Image.Image,
    ) -> tuple[Optional[list], float]:
        """
        Run MediaPipe Face Detection. Returns (bbox, confidence) or (None, 0.0).
        bbox is [x1, y1, x2, y2] in absolute pixel coordinates.
        When multiple faces are found, returns the highest-confidence one.
        """
        img_w, img_h = image.size
        rgb_array = np.array(image)

        with self._mp_face_detection.FaceDetection(
            model_selection=1,
            min_detection_confidence=0.5,
        ) as detector:
            results = detector.process(rgb_array)

        if not results.detections:
            return None, 0.0

        best = max(results.detections, key=lambda d: d.score[0])
        confidence = float(best.score[0])

        bbox_mp = best.location_data.relative_bounding_box

        # MediaPipe returns normalised coordinates (0.0–1.0)
        x1 = clamp(int(bbox_mp.xmin * img_w), 0, img_w)
        y1 = clamp(int(bbox_mp.ymin * img_h), 0, img_h)
        x2 = clamp(int((bbox_mp.xmin + bbox_mp.width) * img_w), 0, img_w)
        y2 = clamp(int((bbox_mp.ymin + bbox_mp.height) * img_h), 0, img_h)

        if x2 <= x1 or y2 <= y1:
            return None, 0.0

        return [x1, y1, x2, y2], confidence

    def _crop_head_region(
        self,
        image: Image.Image,
        face_bbox: list,
    ) -> tuple[Image.Image, tuple]:
        """
        Expand the tight face bbox into a more generous head region.
        Adds padding for forehead (top), ears (sides), and chin (bottom).

        Returns (cropped_image, (offset_x, offset_y)) where offset is the
        top-left corner of the crop in original image coordinates.
        """
        img_w, img_h = image.size
        x1, y1, x2, y2 = face_bbox

        face_w = x2 - x1
        face_h = y2 - y1

        pad_top    = int(face_h * HEAD_PAD_TOP_RATIO)
        pad_side   = int(face_w * HEAD_PAD_SIDE_RATIO)
        pad_bottom = int(face_h * HEAD_PAD_BOTTOM_RATIO)

        cx1 = clamp(x1 - pad_side,   0, img_w)
        cy1 = clamp(y1 - pad_top,    0, img_h)
        cx2 = clamp(x2 + pad_side,   0, img_w)
        cy2 = clamp(y2 + pad_bottom, 0, img_h)

        cropped = image.crop((cx1, cy1, cx2, cy2))
        return cropped, (cx1, cy1)

    def _segment_person(
        self,
        image: Image.Image,
    ) -> tuple[Image.Image, float]:
        """
        Run MediaPipe Selfie Segmentation on the head crop.

        Returns:
            segmented  — PIL image: face pixels intact, background = black
            coverage   — fraction of pixels classified as person (0.0–1.0)

        The coverage metric is a sanity check: very low values mean the
        segmenter rejected the face region itself (bad lighting, occlusion).
        """
        rgb_array = np.array(image)

        with self._mp_selfie_seg.SelfieSegmentation(model_selection=1) as seg:
            result = seg.process(rgb_array)

        raw_mask = result.segmentation_mask         # float32, shape (H, W), range 0–1

        # Binary mask: 1 where confident it's a person, 0 elsewhere
        binary_mask = (raw_mask > self.segmentation_threshold).astype(np.uint8)

        # Morphological cleanup: close small holes, smooth jagged edges
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        binary_mask = cv2.morphologyEx(binary_mask, cv2.MORPH_CLOSE, kernel)
        binary_mask = cv2.GaussianBlur(
            binary_mask.astype(np.float32), (5, 5), 0
        )
        binary_mask = (binary_mask > 0.5).astype(np.uint8)

        coverage = float(binary_mask.sum()) / float(binary_mask.size)

        # Apply mask: keep face pixels, zero out background
        mask_3ch = np.stack([binary_mask] * 3, axis=-1)
        segmented_array = rgb_array * mask_3ch        # background → black (0,0,0)

        segmented_pil = Image.fromarray(segmented_array.astype(np.uint8))
        return segmented_pil, coverage

    def _get_embedding(
        self,
        image: Image.Image,
    ) -> tuple[Optional[np.ndarray], Optional[str]]:
        """
        Extract ArcFace embedding from a segmented face image.

        DeepFace internally runs its own face detector (retinaface) on the
        provided image. Because we've already isolated the head region,
        detection is extremely reliable here.

        Returns (embedding_array, None) on success,
                (None, error_string) on failure.
        """
        try:
            img_array = np.array(image)

            result = DeepFace.represent(
                img_path=img_array,
                model_name=self.deepface_model,
                detector_backend=self.deepface_backend,
                enforce_detection=True,
                align=True,
            )

            if not result or len(result) == 0:
                return None, "DeepFace returned empty result."

            # When multiple faces are found in the crop, use the largest one.
            # In practice this is rare after the head crop.
            best = max(result, key=lambda r: r.get("face_confidence", 0.0))

            raw_embedding = np.array(best["embedding"], dtype="float32")

            # L2 normalise so cosine similarity == dot product in FAISS IndexFlatIP
            norm = np.linalg.norm(raw_embedding)
            if norm == 0.0:
                return None, "Embedding norm is zero — degenerate image."

            embedding = raw_embedding / norm
            return embedding, None

        except Exception as e:
            return None, str(e)

    def _warmup_deepface(self):
        """
        Force DeepFace to download and cache ArcFace weights before first use.
        Uses a tiny blank image — this will fail detection but loads the model.
        """
        try:
            blank = np.zeros((112, 112, 3), dtype=np.uint8)
            DeepFace.represent(
                img_path=blank,
                model_name=self.deepface_model,
                detector_backend=self.deepface_backend,
                enforce_detection=False,
            )
        except Exception:
            pass   # Expected — blank image has no face. Model is loaded.


# ──────────────────────────────────────────────
#  Scoring
# ──────────────────────────────────────────────

def cosine_similarity_score(score_from_faiss: float) -> float:
    """
    FAISS IndexFlatIP returns inner-product scores for L2-normalised vectors,
    which equals cosine similarity in range [-1, 1].
    Map to [0, 1] for display.
    """
    return float(clamp((score_from_faiss + 1.0) / 2.0, 0.0, 1.0))


def score_to_percentage(score: float) -> float:
    return round(clamp(float(score) * 100.0, 0.0, 100.0), 2)
