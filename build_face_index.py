"""
build_face_index.py — Index a Missing Persons Dataset
SahayogHub · Missing Persons Module

Usage:
    python build_face_index.py --dataset missing_persons/

    # Rebuild from scratch (delete old index first):
    python build_face_index.py --dataset missing_persons/ --fresh

    # Resume after interruption (default behaviour — skips already-indexed images):
    python build_face_index.py --dataset missing_persons/

Folder structure expected:
    missing_persons/
        john_doe_001.jpg
        john_doe_002.jpg
        jane_smith_001.jpg
        ...

The filename stem is used as the person_id label in metadata.
Multiple photos of the same person = multiple index entries (better recall).

Outputs:
    face_index.faiss        — FAISS IndexFlatIP (cosine search)
    face_metadata.pkl       — list of dicts, one per indexed image
    face_paths.pkl          — list of str paths (for resume logic)
"""

import argparse
import os
import pickle
from pathlib import Path

import faiss
import numpy as np
from tqdm import tqdm

from face_core import FACE_EMBEDDING_DIM, FaceCore
from vision_core import get_all_image_paths


DEFAULT_DATASET_DIR    = "missing_persons"
DEFAULT_INDEX_FILE     = "face_index.faiss"
DEFAULT_METADATA_FILE  = "face_metadata.pkl"
DEFAULT_PATHS_FILE     = "face_paths.pkl"
DEFAULT_CHECKPOINT     = 25


def load_existing_index(index_file, metadata_file, paths_file):
    files_exist = all(
        Path(f).exists()
        for f in [index_file, metadata_file, paths_file]
    )

    if not files_exist:
        return None, [], []

    print("Existing face index found — resuming...")

    index = faiss.read_index(index_file)

    with open(metadata_file, "rb") as f:
        metadata_records = pickle.load(f)

    with open(paths_file, "rb") as f:
        paths_saved = pickle.load(f)

    if index.ntotal != len(metadata_records):
        raise RuntimeError(
            "Face index and metadata count mismatch. "
            "Run with --fresh to rebuild."
        )

    print(f"Loaded existing index: {index.ntotal} faces.")
    return index, metadata_records, paths_saved


def save_index(index, metadata_records, paths_saved, index_file, metadata_file, paths_file):
    if index is None or index.ntotal == 0:
        print("Nothing to save.")
        return

    faiss.write_index(index, index_file)

    with open(metadata_file, "wb") as f:
        pickle.dump(metadata_records, f)

    with open(paths_file, "wb") as f:
        pickle.dump(paths_saved, f)

    print(f"Saved index: {index.ntotal} faces → {index_file}")


def delete_old_files(index_file, metadata_file, paths_file):
    for path in [index_file, metadata_file, paths_file]:
        if Path(path).exists():
            os.remove(path)
            print(f"Deleted: {path}")


def person_id_from_path(image_path: Path) -> str:
    """
    Derive a person identifier from the image filename.

    Convention: use the filename stem.
    For "john_doe_001.jpg" → person_id = "john_doe_001"

    If your dataset uses subdirectories per person
    (missing_persons/john_doe/001.jpg), switch to:
        return image_path.parent.name
    """
    return image_path.stem


def parse_args():
    parser = argparse.ArgumentParser(
        description="Build FAISS face index for missing persons dataset."
    )
    parser.add_argument("--dataset",       default=DEFAULT_DATASET_DIR)
    parser.add_argument("--index-file",    default=DEFAULT_INDEX_FILE)
    parser.add_argument("--metadata-file", default=DEFAULT_METADATA_FILE)
    parser.add_argument("--paths-file",    default=DEFAULT_PATHS_FILE)
    parser.add_argument(
        "--checkpoint-every", type=int, default=DEFAULT_CHECKPOINT,
        help="Save progress every N images (default: 25).",
    )
    parser.add_argument(
        "--fresh", action="store_true",
        help="Delete existing index and rebuild from scratch.",
    )
    parser.add_argument(
        "--segmentation-threshold", type=float, default=0.6,
        help="MediaPipe segmentation confidence threshold (default: 0.6).",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    if args.fresh:
        delete_old_files(args.index_file, args.metadata_file, args.paths_file)

    image_paths = get_all_image_paths(args.dataset)

    if len(image_paths) == 0:
        print(f"No images found in: {args.dataset}")
        return

    print(f"Found {len(image_paths)} images in dataset.")

    index, metadata_records, paths_saved = load_existing_index(
        args.index_file, args.metadata_file, args.paths_file,
    )

    already_done = set(str(p) for p in paths_saved)
    pending = [p for p in image_paths if str(p) not in already_done]

    if len(pending) == 0:
        print("All images are already indexed.")
        return

    print(f"Pending: {len(pending)} images.")

    face_core = FaceCore(
        segmentation_threshold=args.segmentation_threshold,
    )

    processed_since_save = 0
    skipped = 0
    indexed = 0

    try:
        for image_path in tqdm(pending, desc="Indexing faces"):
            try:
                result = face_core.process(image_path)

                if not result.success:
                    print(f"\nSkipped: {image_path.name} — {result.error}")
                    skipped += 1
                    continue

                embedding = result.embedding.reshape(1, -1)   # (1, 512)

                if index is None:
                    index = faiss.IndexFlatIP(FACE_EMBEDDING_DIM)

                if index.d != embedding.shape[1]:
                    raise RuntimeError(
                        f"Embedding dimension mismatch: expected {index.d}, "
                        f"got {embedding.shape[1]}."
                    )

                person_id = person_id_from_path(image_path)

                metadata = {
                    "image_path":           str(image_path),
                    "person_id":            person_id,
                    "face_bbox":            result.face_bbox,
                    "detection_confidence": result.detection_confidence,
                    "mask_coverage":        result.mask_coverage,
                    "embedding_hash":       result.embedding_hash,
                }

                index.add(embedding)
                metadata_records.append(metadata)
                paths_saved.append(str(image_path))

                indexed += 1
                processed_since_save += 1

                if processed_since_save >= args.checkpoint_every:
                    save_index(
                        index, metadata_records, paths_saved,
                        args.index_file, args.metadata_file, args.paths_file,
                    )
                    processed_since_save = 0

            except Exception as e:
                print(f"\nError on {image_path.name}: {e}")
                skipped += 1

    except KeyboardInterrupt:
        print("\nInterrupted — saving progress...")

    save_index(
        index, metadata_records, paths_saved,
        args.index_file, args.metadata_file, args.paths_file,
    )

    print(f"\nDone. Indexed: {indexed}  |  Skipped: {skipped}")

    if metadata_records:
        ids = [m["person_id"] for m in metadata_records]
        unique_ids = set(ids)
        print(f"Unique persons in index: {len(unique_ids)}")
        print(f"Total face embeddings:   {len(ids)}")


if __name__ == "__main__":
    main()
