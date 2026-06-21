$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPython = "D:\SahayogAI\blur_ai_venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $VenvPython)) {
    throw "D-drive AI venv not found at $VenvPython"
}

Set-Location $ProjectDir

$env:DEVICE = "cuda:0"
$env:EASYOCR_GPU = "1"
$env:OCR_LANGS = "ne,en"
$env:CPU_THREADS = "8"
$env:IMGSZ = "960"
$env:YOLO_CONF = "0.18"
$env:OCR_MAX_SIDE_FAST = "1600"
$env:OCR_MAX_SIDE_BALANCED = "2200"
$env:OCR_BATCH_GPU = "8"
$env:YOLO_CONFIG_DIR = $ProjectDir
$env:OUTPUT_DIR = Join-Path $ProjectDir "api_output"
$env:PYTHONUNBUFFERED = "1"

Write-Host "Python: $VenvPython"
& $VenvPython -c "import torch, torchvision, easyocr; print('Torch:', torch.__version__); print('CUDA:', torch.version.cuda); print('GPU available:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'none'); print('Torchvision:', torchvision.__version__)"

& $VenvPython -m uvicorn api:app --host 0.0.0.0 --port 8012
