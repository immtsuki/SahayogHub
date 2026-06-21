# Sensitive Image Redactor: FastAPI + YOLO + OCR fallback

This project automatically blurs sensitive fields from uploaded Nepali/English documents.

It has two engines:

1. **YOLO engine**: fastest, uses `models/sensitive_fields.pt` after training.
2. **OCR fallback**: uses `redact_sensitive_images_v3.py` if YOLO model is not trained yet.

## Folder structure

```text
sensitive_redactor_complete/
├── server_yolo_fastapi.py
├── redact_sensitive_images_v3.py
├── requirements.txt
├── run_server.sh
├── models/
│   └── sensitive_fields.pt
├── training/
│   ├── train_yolo.py
│   ├── data.yaml
│   └── data_runtime.yaml
├── datasets/
│   └── sensitive_fields/
│       ├── images/train/
│       ├── images/val/
│       ├── labels/train/
│       └── labels/val/
└── api_output/
    ├── uploads/
    ├── originals/
    ├── redacted/
    └── json/
```

## Install

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run API now, even without YOLO

```bash
uvicorn server_yolo_fastapi:app --reload --host 0.0.0.0 --port 8012
```

Open:

```text
http://127.0.0.1:8012/docs
```

Upload using curl:

```bash
curl -X POST "http://127.0.0.1:8012/redact?engine=auto&mode=blur" \
  -F "file=@nagrita/Pasted image (2).png"
```

If `models/sensitive_fields.pt` exists, `engine=auto` uses YOLO. Otherwise it uses OCR fallback.

## Train YOLO

First label your documents in YOLO format.

Required structure:

```text
datasets/sensitive_fields/images/train/*.jpg
datasets/sensitive_fields/labels/train/*.txt
datasets/sensitive_fields/images/val/*.jpg
datasets/sensitive_fields/labels/val/*.txt
```

Train:

```bash
python training/train_yolo.py
```

Copy model:

```bash
mkdir -p models
cp runs/redaction/sensitive_fields_yolo11n/weights/best.pt models/sensitive_fields.pt
```

Restart FastAPI. Now `engine=auto` will use YOLO.

## API modes

OCR fallback:

```bash
curl -X POST "http://127.0.0.1:8012/redact?engine=ocr&mode=blur&ocr_passes=balanced" \
  -F "file=@nagrita/Pasted image (2).png"
```

YOLO only:

```bash
curl -X POST "http://127.0.0.1:8012/redact?engine=yolo&mode=blur" \
  -F "file=@nagrita/Pasted image (2).png"
```

Blur photo too:

```bash
curl -X POST "http://127.0.0.1:8012/redact?engine=auto&mode=blur&redact_photo=true" \
  -F "file=@nagrita/Pasted image (2).png"
```
