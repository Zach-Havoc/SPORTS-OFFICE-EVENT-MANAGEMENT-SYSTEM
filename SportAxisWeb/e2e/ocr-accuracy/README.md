# OCR accuracy test (Precision, Recall, F1-score)

Measures how well SportAxis reads scores from photographed paper score sheets.
It runs locally against the OCR service (`OCR/service.py`, port 5001) and uses
the system's own score matching (`OcrController`), so the numbers describe
what a committee member actually gets back.

## Synthetic sheets (about 50, generated)

Requires: the OCR service running (`cd OCR && paddleocr-env/bin/python service.py`),
Chrome (the Selenium one is fine), PHP and the backend `.env`.

```bash
cd SportAxisWeb
npx vite-node e2e/ocr-accuracy/generate.ts 54            # 1. clean sheets → out/clean/
../OCR/paddleocr-env/bin/python e2e/ocr-accuracy/distort.py   # 2. "photos" → out/sheets/
../OCR/paddleocr-env/bin/python e2e/ocr-accuracy/evaluate.py  # 3. OCR + scoring → out/results/
```

1. **generate.ts** prints the real score-sheet layouts (`buildScoreSheetHtml`:
   basketball, volleyball, beach volleyball, badminton, table tennis, general)
   for a random pair of colleges and fills them in with handwriting fonts:
   the final scores in the official boxes, plus the clutter a real sheet has
   (set/quarter scores, jersey numbers, tally marks). It records each number
   and its position. The seed is fixed, so the set is reproducible.
2. **distort.py** turns each into a photo of one of three qualities, in turn so
   every layout appears under every condition:
   `scan` (straight, sharp), `phone` (tilt, slight perspective, shadow, mild
   blur) and `poor` (strong tilt/perspective, heavy shadow, blur, low
   resolution, strong JPEG compression).
3. **evaluate.py** sends each photo to the OCR service (timed; the reply is
   cached in `out/results/<id>.ocr.json`, delete it to re-read) and scores it.

### A held-out test set

The matching rules were tuned while looking at the default 54 sheets, so
their score on those is optimistic. A second set with another seed, which the
rules were never tuned on, gives the fair figure:

```bash
export OCR_SET=heldout OCR_SEED=777
npx vite-node e2e/ocr-accuracy/generate.ts 36
../OCR/paddleocr-env/bin/python e2e/ocr-accuracy/distort.py
../OCR/paddleocr-env/bin/python e2e/ocr-accuracy/evaluate.py   # → out/heldout/results/
```

### Results (2026-10-11)

Score extraction, before and after the matching rewrite (`OcrScoreMatcher`):

| Set | Before: P / R / F1 | After: P / R / F1 | Sheets fully correct |
|---|---|---|---|
| Tuning set, 54 sheets | 0.20 / 0.15 / 0.17 | 0.98 / 0.86 / 0.92 | 5 → 41 |
| **Held-out set, 36 sheets** | 0.20 / 0.17 / 0.18 | **0.98 / 0.90 / 0.94** | 4 → 30 |

Reading the handwritten numbers (the OCR model itself, unchanged): F1 0.80
(tuning) and 0.85 (held-out). Most scores still missed are digits the model
did not read at all, mostly the small "sets won" boxes on the volleyball
sheet; the matcher can't recover a number that was never read.

## Real sheets (later)

Photograph filled-in sheets with a phone, put the photos in one folder with a
`ground_truth.csv`, one row per college per photo:

```csv
file,department,score,sport,condition
IMG_0001.jpg,College of Arts and Sciences,78,Basketball,phone
IMG_0001.jpg,College of Informatics and Computing Sciences,81,Basketball,phone
```

`department` must be the full college name as stored in SportAxis; `sport`
and `condition` are optional and only used to group the results. Then:

```bash
../OCR/paddleocr-env/bin/python e2e/ocr-accuracy/evaluate.py --real path/to/folder
```

Results go to `path/to/folder/results/`. Real photos have no number
positions, so only the score-extraction level is computed.

## What is measured

**Recognition** (synthetic only) — did the OCR read each handwritten number?
For each number, the OCR text line covering its box (≥30% overlap) is taken:

- TP: the line contains the number
- FP: the line holds a different number (a misread)
- FN: no line with a number covers it (missed)

**Score extraction** — did SportAxis return the right score per college?

- TP: college returned with the correct score
- FP: college returned with a wrong score
- FN: college not returned (the committee types it in)

Precision = TP / (TP + FP), Recall = TP / (all expected), F1 = 2PR / (P + R).

`out/results/summary.json` breaks these down by layout and by photo condition,
and adds sheets fully correct and OCR time (mean, median, max, how many over
the 120 s timeout). `sheets.csv` has one row per sheet: expected vs returned.
