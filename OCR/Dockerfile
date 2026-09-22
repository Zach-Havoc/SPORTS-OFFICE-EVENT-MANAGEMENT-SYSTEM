# PaddleOCR service — versions pinned to exactly what's tested locally
# (see paddleocr-env/lib/python3.11/site-packages/*.dist-info).
FROM python:3.11-slim

# opencv-contrib-python (PaddleOCR's dependency) links against these even
# though nothing here ever opens a display — missing them fails at import
# time with "libGL.so.1: cannot open shared object file". libgomp1 is
# needed by PaddlePaddle's OpenMP-based CPU ops.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --no-cache-dir \
    paddlepaddle==3.3.1 \
    paddleocr==3.7.0 \
    flask==3.1.3

COPY service.py .

# Model weights (~2GB) are downloaded on first request and cached here —
# mount a volume at this path (see README) so a container restart doesn't
# re-download them. Same cache PaddleX uses outside Docker (~/.paddlex).
ENV HOME=/app
VOLUME ["/app/.paddlex"]

ENV OCR_SERVICE_HOST=0.0.0.0
ENV OCR_SERVICE_PORT=5001
EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
    CMD curl -f http://127.0.0.1:5001/health || exit 1

CMD ["python3", "service.py"]
