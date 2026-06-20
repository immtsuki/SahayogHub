#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

import torch
import yaml
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
DATA_TEMPLATE = ROOT / "training" / "data.yaml"
DATA_RUNTIME = ROOT / "training" / "data_runtime.yaml"
DATASET_ROOT = ROOT / "datasets" / "sensitive_fields"


def prepare_data_yaml() -> Path:
    data = yaml.safe_load(DATA_TEMPLATE.read_text(encoding="utf-8"))
    data["path"] = str(DATASET_ROOT)
    DATA_RUNTIME.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
    return DATA_RUNTIME


def check_dataset() -> None:
    required_dirs = [
        DATASET_ROOT / "images" / "train",
        DATASET_ROOT / "images" / "val",
        DATASET_ROOT / "labels" / "train",
        DATASET_ROOT / "labels" / "val",
    ]
    for d in required_dirs:
        d.mkdir(parents=True, exist_ok=True)

    train_images = list((DATASET_ROOT / "images" / "train").glob("*"))
    val_images = list((DATASET_ROOT / "images" / "val").glob("*"))
    if not train_images or not val_images:
        raise SystemExit(
            "Dataset is empty. Add labeled YOLO images first:\n"
            f"  {DATASET_ROOT}/images/train/*.jpg\n"
            f"  {DATASET_ROOT}/labels/train/*.txt\n"
            f"  {DATASET_ROOT}/images/val/*.jpg\n"
            f"  {DATASET_ROOT}/labels/val/*.txt\n"
        )


def main() -> None:
    check_dataset()
    data_yaml = prepare_data_yaml()

    use_cuda = torch.cuda.is_available()
    device = 0 if use_cuda else "cpu"

    print(f"Project root: {ROOT}")
    print(f"Dataset root: {DATASET_ROOT}")
    print(f"CUDA available: {use_cuda}")
    print(f"Training device: {device}")
    if use_cuda:
        print(f"GPU: {torch.cuda.get_device_name(0)}")

    model = YOLO("yolo11n.pt")
    model.train(
        data=str(data_yaml),
        epochs=80,
        imgsz=640 if not use_cuda else 960,
        batch=2 if not use_cuda else 8,
        device=device,
        workers=2,
        project=str(ROOT / "runs" / "redaction"),
        name="sensitive_fields_yolo11n",
    )

    best = ROOT / "runs" / "redaction" / "sensitive_fields_yolo11n" / "weights" / "best.pt"
    print("\nTraining finished.")
    print(f"Best model should be here: {best}")
    print("Copy it to models/sensitive_fields.pt:")
    print(f"  mkdir -p {ROOT / 'models'}")
    print(f"  cp {best} {ROOT / 'models' / 'sensitive_fields.pt'}")


if __name__ == "__main__":
    main()
