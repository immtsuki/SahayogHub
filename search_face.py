"""
search_face.py — Search a Query Photo Against Missing Persons Index
SahayogHub · Missing Persons Module

Usage:
    # Put query image in query/ folder, then:
    python search_face.py

    # Or pass image directly:
    python search_face.py --query-image path/to/photo.jpg

    # Return top 10 results:
    python search_face.py --top-k 10

    # Lower threshold to cast wider net:
    python search_face.py --min-similarity 0.50

Output:
    result/query_segmented.jpg   — segmented face extracted from query image
    result/match_1_...jpg        — top-ranked match images with labels
    result/face_results.txt      — plain-text summary
    result/face_results.html     — visual HTML report
"""

import argparse
import html
import pickle
from pathlib import Path

import faiss
import numpy as np

from face_core import (
    FaceCore,
    FaceSearchResult,
    cosine_similarity_score,
    score_to_percentage,
)
from vision_core import is_image_file, safe_filename, save_labeled_image


DEFAULT_INDEX_FILE     = "face_index.faiss"
DEFAULT_METADATA_FILE  = "face_metadata.pkl"
DEFAULT_QUERY_DIR      = "query"
DEFAULT_RESULT_DIR     = "result"
DEFAULT_TOP_K          = 5
DEFAULT_RERANK_LIMIT   = 100
DEFAULT_MIN_SIMILARITY = 0.55     # scores below this are not shown


def find_query_image(query_dir, query_image=None) -> Path:
    if query_image:
        path = Path(query_image)
        if not path.exists():
            raise FileNotFoundError(f"Query image not found: {path}")
        return path

    query_dir = Path(query_dir)
    preferred = query_dir / "query.jpg"

    if preferred.exists():
        return preferred

    if not query_dir.exists():
        raise FileNotFoundError(
            f"Query folder not found: {query_dir}\n"
            "Create it with: mkdir query"
        )

    images = [f for f in query_dir.iterdir() if is_image_file(f)]

    if len(images) == 0:
        raise FileNotFoundError(f"No images found in: {query_dir}")

    return sorted(images)[0]


def load_index_and_metadata(index_file, metadata_file):
    if not Path(index_file).exists():
        raise FileNotFoundError(
            f"{index_file} not found.\n"
            "Run: python build_face_index.py --dataset missing_persons/"
        )

    if not Path(metadata_file).exists():
        raise FileNotFoundError(
            f"{metadata_file} not found.\n"
            "Run: python build_face_index.py --dataset missing_persons/"
        )

    index = faiss.read_index(index_file)

    with open(metadata_file, "rb") as f:
        metadata_records = pickle.load(f)

    if index.ntotal != len(metadata_records):
        raise RuntimeError(
            "Index and metadata count mismatch. "
            "Run: python build_face_index.py --fresh"
        )

    print(f"Loaded index: {index.ntotal} faces.")
    return index, metadata_records


def parse_args():
    parser = argparse.ArgumentParser(
        description="Search a query photo against the missing persons index."
    )
    parser.add_argument("--index-file",    default=DEFAULT_INDEX_FILE)
    parser.add_argument("--metadata-file", default=DEFAULT_METADATA_FILE)
    parser.add_argument("--query-dir",     default=DEFAULT_QUERY_DIR)
    parser.add_argument("--query-image",   default=None)
    parser.add_argument("--result-dir",    default=DEFAULT_RESULT_DIR)
    parser.add_argument("--top-k",         type=int,   default=DEFAULT_TOP_K)
    parser.add_argument("--rerank-limit",  type=int,   default=DEFAULT_RERANK_LIMIT)
    parser.add_argument(
        "--min-similarity", type=float, default=DEFAULT_MIN_SIMILARITY,
        help="Minimum similarity score to include in results (0.0–1.0).",
    )
    parser.add_argument(
        "--segmentation-threshold", type=float, default=0.6,
        help="MediaPipe segmentation confidence (default: 0.6).",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    result_dir = Path(args.result_dir)
    result_dir.mkdir(exist_ok=True)

    index, metadata_records = load_index_and_metadata(
        args.index_file, args.metadata_file,
    )

    query_image_path = find_query_image(args.query_dir, args.query_image)
    print(f"Query image: {query_image_path}")

    face_core = FaceCore(
        segmentation_threshold=args.segmentation_threshold,
    )

    # ── Process the query image ──────────────────────────────────────────
    print("Processing query image...")
    query_result = face_core.process(query_image_path)

    if not query_result.success:
        print(f"\nCannot search: {query_result.error}")
        print("Check that the query image contains a clearly visible face.")
        return

    print(f"Query face detected. "
          f"Confidence: {round(query_result.detection_confidence * 100, 1)}%  "
          f"Mask coverage: {round(query_result.mask_coverage * 100, 1)}%")

    # Save segmented query face for visual inspection
    query_seg_path = result_dir / "query_segmented.jpg"
    query_label_lines = [
        f"Query: {query_image_path.name}",
        f"Detection confidence: {round(query_result.detection_confidence * 100, 1)}%",
        f"Segmentation coverage: {round(query_result.mask_coverage * 100, 1)}%",
    ]
    save_labeled_image(query_result.segmented_face, query_seg_path, query_label_lines)

    # ── FAISS search ─────────────────────────────────────────────────────
    query_embedding = query_result.embedding.reshape(1, -1)   # (1, 512)
    search_k = min(args.rerank_limit, index.ntotal)

    faiss_scores, faiss_indices = index.search(query_embedding, search_k)

    # ── Build ranked results ─────────────────────────────────────────────
    search_results: list[FaceSearchResult] = []

    for raw_rank, idx in enumerate(faiss_indices[0]):
        if idx == -1:
            continue

        raw_score = float(faiss_scores[0][raw_rank])
        similarity = cosine_similarity_score(raw_score)

        if similarity < args.min_similarity:
            continue

        meta = metadata_records[idx]

        search_results.append(FaceSearchResult(
            rank=0,                              # assigned after sort
            image_path=meta["image_path"],
            person_id=meta.get("person_id"),
            similarity_score=similarity,
            similarity_pct=score_to_percentage(similarity),
            detection_confidence=meta.get("detection_confidence", 0.0),
            face_bbox=meta.get("face_bbox"),
            metadata=meta,
        ))

    # Sort by similarity descending, assign final rank
    search_results.sort(key=lambda r: r.similarity_score, reverse=True)
    top_results = search_results[:args.top_k]

    for rank_idx, result in enumerate(top_results, start=1):
        result.rank = rank_idx

    # ── Output ───────────────────────────────────────────────────────────
    if len(top_results) == 0:
        print(
            f"\nNo matches found above similarity threshold ({args.min_similarity}).\n"
            f"Try: python search_face.py --min-similarity 0.45"
        )
        return

    print(f"\nTop {len(top_results)} Matching Results:\n")

    result_lines = []
    html_items = []

    result_lines.append(f"Query image:              {query_image_path}")
    result_lines.append(f"Detection confidence:     {round(query_result.detection_confidence * 100, 1)}%")
    result_lines.append(f"Segmentation coverage:    {round(query_result.mask_coverage * 100, 1)}%")
    result_lines.append("")
    result_lines.append("Top matches:")
    result_lines.append("")

    for item in top_results:
        image_path = Path(item.image_path)

        print(f"Rank {item.rank}")
        print(f"  Person ID:      {item.person_id}")
        print(f"  Similarity:     {item.similarity_pct}%")
        print(f"  Image:          {item.image_path}")
        print()

        # Save a labeled copy of the matched image
        try:
            from vision_core import open_image_correctly, crop_from_metadata
            matched_img = crop_from_metadata(item.image_path, item.metadata)
        except Exception:
            from vision_core import open_image_correctly
            matched_img = open_image_correctly(item.image_path)

        output_filename = safe_filename(
            f"match_{item.rank}_{item.similarity_pct}pct_{image_path.name}"
        )
        output_path = result_dir / output_filename

        label_lines = [
            f"Rank #{item.rank}",
            f"Similarity: {item.similarity_pct}%",
            f"Person ID: {item.person_id}",
        ]
        save_labeled_image(matched_img, output_path, label_lines)

        result_lines += [
            f"Rank {item.rank}",
            f"  Person ID:      {item.person_id}",
            f"  Similarity:     {item.similarity_pct}%",
            f"  Image:          {item.image_path}",
            f"  Saved:          {output_path}",
            "",
        ]

        html_items.append(f"""
        <div style="border:1px solid #ccc; border-radius:8px; padding:16px; margin-bottom:24px;">
            <h2 style="margin-top:0">Rank {item.rank} — {item.similarity_pct}% match</h2>
            <p><b>Person ID:</b> {html.escape(str(item.person_id))}</p>
            <p><b>Image:</b> {html.escape(str(item.image_path))}</p>
            <img src="{html.escape(output_filename)}" width="400"
                 style="border-radius:4px; border:1px solid #eee;">
        </div>
        """)

    # Save plain-text results
    txt_path = result_dir / "face_results.txt"
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(result_lines))

    # Save HTML report
    html_path = result_dir / "face_results.html"
    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>SahayogHub — Missing Person Search Results</title>
    <style>
        body {{ font-family: Arial, sans-serif; padding: 24px; max-width: 900px; margin: auto; }}
        h1   {{ color: #1a1a2e; }}
        img  {{ max-width: 100%; }}
    </style>
</head>
<body>
    <h1>🤝 SahayogHub — Missing Person Search Results</h1>

    <h2>Query Image</h2>
    <p><b>File:</b> {html.escape(str(query_image_path))}</p>
    <p><b>Face detection confidence:</b> {round(query_result.detection_confidence * 100, 1)}%</p>
    <p><b>Segmentation coverage:</b> {round(query_result.mask_coverage * 100, 1)}%</p>
    <img src="query_segmented.jpg" width="400"
         style="border-radius:4px; border:1px solid #eee;">

    <hr>

    <h2>Top Matches</h2>
    {''.join(html_items)}
</body>
</html>"""

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"Results saved to: {result_dir}/")
    print(f"Open: {html_path}")


if __name__ == "__main__":
    main()
