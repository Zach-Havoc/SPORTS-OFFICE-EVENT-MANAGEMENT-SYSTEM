# Local OCR service (PaddleOCR)

A small, free, self-hosted OCR service the Laravel backend calls at
`POST /api/ocr/extract` to read scores off a photographed scoresheet — no
API key, no per-image cost, no data leaving this server.

## Why this exists, and its real limitation

This uses [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) — a real
text-recognition engine, meaningfully better than Tesseract, but still
**classic OCR, not a model that understands the document.** It reads text; it
has no idea which number belongs to which college. `OcrController` works
that out itself, by searching the recognised text for each competing
college's name and pulling a number from that same line — a scoresheet that
doesn't write the college name near its score won't get a match, and that
college's score is left for the judge to enter manually rather than guessed.

## One-time setup (already done on this machine, documented for a new one)

PaddleOCR only supports Python 3.8–3.12. If the system Python is newer (this
machine's is 3.14), don't touch the system Python — fetch an isolated one
with [`uv`](https://docs.astral.sh/uv/) instead, no root/sudo required:

```bash
cd OCR
uv python install 3.11
uv venv --python 3.11 paddleocr-env
source paddleocr-env/bin/activate
uv pip install paddlepaddle paddleocr flask
```

The first run downloads the actual model weights (~20-30s, needs internet
access to PaddlePaddle's model hosting) and caches them in
`~/.paddlex/official_models/` — only happens once.

### A CPU compatibility workaround you need to know about

On at least this machine, PaddlePaddle's oneDNN CPU-acceleration path throws
`NotImplementedError: ConvertPirAttribute2RuntimeAttribute not support ...`
on inference — not a hardware limitation (this CPU has full AVX-512), a
bug in that specific optimized code path. `service.py` already works around
it (`enable_mkldnn=False`). If you ever see that exact error again, that flag
is where to look first.

## Running it

```bash
./start.sh
```

Keep this running — in production, under a supervisor (systemd/supervisor),
the same way `reverb:start` needs to be kept running. The model loads once at
startup (~20-30s) and stays warm in memory; each request after that is
roughly 1-2 seconds on CPU. Don't spawn a fresh process per scan — that
would pay the full model-load cost on every single photo.

Health check: `curl http://127.0.0.1:5001/health` → `{"status":"ok"}`

The Laravel backend finds it via `OCR_SERVICE_URL` in `.env` (defaults to
`http://127.0.0.1:5001`, see `config/services.php`).

## Deploying to a real server (Oracle Cloud "Always Free")

Once the Laravel backend runs somewhere that can't run Python itself (e.g.
InfinityFree), this service needs its own always-on host. Oracle Cloud's
Always Free tier (a real Ampere A1 VM, not a spin-down trial) is a good fit —
enough RAM to run PaddleOCR reliably, no cold starts, genuinely free
indefinitely.

**1. Create the VM** — Oracle Cloud Console → Compute → Instances → Create:
   Ubuntu 22.04/24.04, shape **VM.Standard.A1.Flex** (2 OCPU / 12GB is
   plenty), assign a public IP, download the SSH key. Open port `5001` in
   both the VCN's Security List **and** the VM's own firewall (see below).

**2. SSH in and install prerequisites:**
```bash
ssh -i your-key.pem ubuntu@<vm-public-ip>
sudo apt update && sudo apt install -y git curl build-essential
curl -LsSf https://astral.sh/uv/install.sh | sh   # installs uv, no sudo needed
source $HOME/.local/bin/env
```

**3. Clone the repo and set up the same venv as local dev:**
```bash
git clone https://github.com/Zach-Havoc/SPORTS-OFFICE-EVENT-MANAGEMENT-SYSTEM.git
cd SPORTS-OFFICE-EVENT-MANAGEMENT-SYSTEM/OCR
uv python install 3.11
uv venv --python 3.11 paddleocr-env
source paddleocr-env/bin/activate
uv pip install paddlepaddle paddleocr flask
deactivate
```
First run of the service downloads the model weights (~20-30s, needs
outbound internet access) — that happens automatically on first start below.

**4. Generate an API key and open the OS firewall:**
```bash
openssl rand -hex 32   # save this — you'll put it in two places below
sudo ufw allow 5001/tcp   # or the equivalent for whatever firewall the image ships with
```

**5. Install and start the systemd service** — copy `paddleocr.service` from
this repo to the VM, fill in the `OCR_API_KEY` line with the key from step 4
(uncomment it), then:
```bash
sudo cp paddleocr.service /etc/systemd/system/paddleocr.service
sudo systemctl daemon-reload
sudo systemctl enable --now paddleocr
sudo systemctl status paddleocr        # should show "active (running)"
journalctl -u paddleocr -f             # watch the model load (~20-30s first time)
```

### Alternative to steps 2-5: Docker

A `Dockerfile` is included, pinned to the exact package versions tested
locally (`paddlepaddle==3.3.1`, `paddleocr==3.7.0`, `flask==3.1.3`). Use this
instead of the bare-venv + systemd setup above if you'd rather not manage
Python/venv on the host directly — and it's **required**, not optional, if
you go with Cloud Run or Render instead of a VM, since those only run
containers.

```bash
# On the VM (needs Docker installed: `sudo apt install docker.io`), or
# anywhere else that can run a container:
cd OCR
docker build -t sportsaxis-ocr .

# -v persists the downloaded model weights across container restarts —
# without it, every restart re-downloads ~2GB on first request.
docker run -d --name sportsaxis-ocr \
  -p 5001:5001 \
  -v paddleocr-models:/app/.paddlex \
  -e OCR_API_KEY=REPLACE_WITH_A_LONG_RANDOM_SECRET \
  --restart unless-stopped \
  sportsaxis-ocr

docker logs -f sportsaxis-ocr   # watch the model load (~20-30s first time)
```

The container binds `0.0.0.0:5001` by default (`ENV OCR_SERVICE_HOST=0.0.0.0`
in the Dockerfile) and includes a `HEALTHCHECK` hitting `/health`, so
`docker ps` shows its status directly. Skip `paddleocr.service` entirely if
you use this path — `--restart unless-stopped` covers what systemd was for.

**Not build-tested here** — this sandbox has no Docker installed, so I
verified the Python/Flask logic directly (the auth-guard tests earlier) but
not an actual `docker build`. Run the build yourself before relying on it;
if it fails, paste me the error and I'll fix the Dockerfile.

**6. Verify it's reachable from outside the VM:**
```bash
curl http://<vm-public-ip>:5001/health
# {"status":"ok"}
curl -X POST http://<vm-public-ip>:5001/extract \
  -H "X-OCR-Api-Key: <the key from step 4>" \
  -H "Content-Type: application/json" \
  -d '{"image":"<base64-of-a-test-image>"}'
# an X-OCR-Api-Key that's missing or wrong should get a 401
```

**7. Point the Laravel backend at it** — in the backend's production `.env`
(wherever that's hosted):
```
OCR_SERVICE_URL=http://<vm-public-ip>:5001
OCR_API_KEY=<the same key from step 4>
```

After a reboot or crash, systemd restarts the service automatically
(`Restart=always` in the unit file) — no manual `./start.sh` needed on a
real server, unlike local dev.

## What it does and doesn't do

`service.py` is deliberately dumb — given an image, it returns every text
line it recognised plus a confidence score. It knows nothing about
SportAxis, departments, or scoresheets; all of that matching logic lives in
`OcrController.php`, not here. That split keeps this service reusable and
easy to test in isolation (`curl -X POST .../extract -d '{"image":"<base64>"}'`).
