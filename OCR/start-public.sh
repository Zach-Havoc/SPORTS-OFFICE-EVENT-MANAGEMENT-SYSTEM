#!/usr/bin/env bash
# Serves this laptop's OCR to the deployed API (Render) through an ngrok
# tunnel. Scanning in the deployed app works only while this is running.
# Settings live in OCR/public.env (not committed):
#   OCR_API_KEY=<same value as OCR_API_KEY on Render>
#   NGROK_DOMAIN=<your free ngrok domain, e.g. something.ngrok-free.app>
# Render's OCR_SERVICE_URL is https://<NGROK_DOMAIN>. See README.md.
set -e
cd "$(dirname "$0")"
[ -f public.env ] && . ./public.env
: "${OCR_API_KEY:?Set OCR_API_KEY in OCR/public.env}"
: "${NGROK_DOMAIN:?Set NGROK_DOMAIN in OCR/public.env}"
export OCR_API_KEY

# A service already on 5001 (e.g. ./start.sh) has no key — tunnelling to it
# would let anyone use it. Make the user stop it first.
if curl -sf http://127.0.0.1:5001/health >/dev/null; then
    echo "Something is already running on port 5001 (probably ./start.sh). Stop it, then run this again."
    exit 1
fi

# The service stays on 127.0.0.1; only the tunnel reaches it from outside,
# and /extract requires the key.
source paddleocr-env/bin/activate
python3 service.py &
SERVICE_PID=$!
trap 'kill $SERVICE_PID 2>/dev/null' EXIT

until curl -sf http://127.0.0.1:5001/health >/dev/null; do
    kill -0 $SERVICE_PID 2>/dev/null || { echo "OCR service failed to start"; exit 1; }
    sleep 2
done
echo "OCR ready — opening https://${NGROK_DOMAIN} (Ctrl+C stops both)"
ngrok http --url="https://${NGROK_DOMAIN}" 5001 --log=false
