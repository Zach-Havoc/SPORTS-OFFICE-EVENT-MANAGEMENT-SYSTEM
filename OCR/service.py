"""
PaddleOCR local service — a tiny, dumb OCR endpoint for the Laravel backend.

Loads the OCR model ONCE at startup (cold start is ~20-30s) and keeps it warm
in memory, so each request only pays inference cost, not model-load cost.
Laravel's OcrController posts an image here, gets back every text line the
model found plus its confidence, and does the "which line is which
college's score" matching itself — this service knows nothing about
departments, scoresheets, or SportAxis; it just reads text out of an image.

Run with: ./start.sh  (see that script — activates the venv first)
"""

import base64
import hmac
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor

import cv2
import numpy as np
from flask import Flask, jsonify, request
from paddleocr import PaddleOCR

app = Flask(__name__)

# Unset (local dev, service only reachable via 127.0.0.1) = no auth needed.
# Set (anywhere internet-reachable, e.g. the Oracle VM) = every /extract
# call must send a matching X-OCR-Api-Key header, or a stranger who finds
# the IP:port can burn CPU on this box for free. Laravel sends it via
# OCR_API_KEY -> config('services.ocr.api_key') (see OcrController.php).
API_KEY = os.environ.get("OCR_API_KEY", "")


@app.before_request
def check_api_key():
    if not API_KEY:
        return None
    if request.path == "/health":
        return None
    sent = request.headers.get("X-OCR-Api-Key", "")
    if not hmac.compare_digest(sent, API_KEY):
        return jsonify({"error": "Invalid or missing X-OCR-Api-Key"}), 401
    return None

def load_ocr(enable_mkldnn):
    return PaddleOCR(
        lang="en",
        enable_mkldnn=enable_mkldnn,
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )


def warm_up(model):
    # A line of text, so both detection and recognition actually run.
    img = np.full((120, 480, 3), 255, dtype=np.uint8)
    cv2.putText(img, "CICS 45", (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 0, 0), 4)
    model.predict(img)


def load_warm():
    # oneDNN (enable_mkldnn) makes CPU inference ~3x faster: a 215-line sheet
    # took 15s instead of 42s on the dev laptop. paddlepaddle 3.3.x crashes in
    # it (NotImplementedError: ConvertPirAttribute2RuntimeAttribute), hence the
    # pinned 3.2.2. It fails at inference, not load, so warm up to find out,
    # and fall back to plain CPU rather than fail every scan.
    try:
        model = load_ocr(enable_mkldnn=True)
        warm_up(model)
        print("Model loaded (oneDNN on) — ready.")
    except Exception as e:
        print(f"oneDNN unavailable ({type(e).__name__}); using plain CPU, about 3x slower.")
        model = load_ocr(enable_mkldnn=False)
        print("Model loaded — ready.")
    return model


# Every model call runs on this one thread. oneDNN keeps per-thread state, and
# Flask gives each request a new thread: predicting from those failed every
# other scan with "std::exception". One worker also means one scan at a time,
# so a client that gives up and retries doesn't run a second scan next to the
# abandoned one, with both crawling.
ocr_worker = ThreadPoolExecutor(max_workers=1)
print("Loading PaddleOCR model (one-time cost, ~20-30s)...")
ocr = ocr_worker.submit(load_warm).result()


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/extract", methods=["POST"])
def extract():
    data = request.get_json(silent=True) or {}
    image_b64 = data.get("image")
    if not image_b64:
        return jsonify({"error": "Missing 'image' (base64)"}), 400

    if image_b64.startswith("data:"):
        image_b64 = image_b64.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(image_b64, validate=True)
    except Exception:
        return jsonify({"error": "Invalid base64 image data"}), 400

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name

        results = ocr_worker.submit(ocr.predict, tmp_path).result()
        lines = []
        for res in results:
            texts = res.get("rec_texts", [])
            scores = res.get("rec_scores", [])
            polys = res.get("rec_polys", res.get("dt_polys", []))
            for i, text in enumerate(texts):
                score = float(scores[i]) if i < len(scores) else None
                poly = polys[i].tolist() if i < len(polys) and hasattr(polys[i], "tolist") else None
                lines.append({"text": text, "confidence": score, "poly": poly})

        return jsonify({"lines": lines})
    except Exception as e:
        return jsonify({"error": f"OCR processing failed: {e}"}), 500
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


if __name__ == "__main__":
    port = int(os.environ.get("OCR_SERVICE_PORT", 5001))
    # 127.0.0.1 = only reachable from this same machine (local dev default).
    # Set OCR_SERVICE_HOST=0.0.0.0 on a real server so Laravel can reach it
    # from elsewhere — only do that once OCR_API_KEY above is also set.
    host = os.environ.get("OCR_SERVICE_HOST", "127.0.0.1")
    app.run(host=host, port=port)
