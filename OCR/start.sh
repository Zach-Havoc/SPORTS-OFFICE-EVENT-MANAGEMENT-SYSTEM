#!/usr/bin/env bash
# Starts the local PaddleOCR service. Keep this running (e.g. under
# systemd/supervisor in production) — the model loads once at startup
# (~20-30s) and stays warm in memory for every request after that.
set -e
cd "$(dirname "$0")"
source paddleocr-env/bin/activate
exec python3 service.py
