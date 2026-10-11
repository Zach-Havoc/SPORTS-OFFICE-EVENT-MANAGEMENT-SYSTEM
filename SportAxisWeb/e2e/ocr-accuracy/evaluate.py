"""OCR accuracy test: Precision, Recall and F1-score.

Synthetic sheets (made by generate.ts + distort.py):
    OCR/paddleocr-env/bin/python e2e/ocr-accuracy/evaluate.py

Real photographed sheets (see README.md for the ground-truth file):
    OCR/paddleocr-env/bin/python e2e/ocr-accuracy/evaluate.py --real path/to/photos

Each photo is sent to the running OCR service (OCR_SERVICE_URL, default
http://127.0.0.1:5001), timed, and its output saved (re-runs reuse it).
Two levels are scored:

1. Recognition (synthetic sheets only, where every number's position is
   known): for each handwritten number, the OCR text line over it is found.
   Correct (TP) if that line contains the number; wrong (FP) if it holds
   a different number; missed (FN) if no line with a number covers it.
     Precision = TP / (TP + FP)      Recall = TP / (all numbers)

2. Score extraction (what SportAxis returns): the system's own matching code
   (match.php) turns the OCR output into a score per college. For each
   college on the sheet: correct (TP) if returned with the right score;
   wrong (FP) if returned with another score; missed if not returned.
     Precision = TP / (scores returned)   Recall = TP / (scores on the sheets)

F1 = 2PR / (P + R). Results go to out/results/ (summary.json, sheets.csv).
"""
import argparse
import base64
import csv
import json
import os
import re
import statistics
import subprocess
import sys
import time
import urllib.request
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.abspath(os.path.join(HERE, '..', '..', 'backend'))
OCR_URL = os.environ.get('OCR_SERVICE_URL', 'http://127.0.0.1:5001').rstrip('/') + '/extract'
NUM = re.compile(r'\d{1,3}(?:\.\d{1,2})?')


def ocr(path, cache):
    if os.path.exists(cache):
        return json.load(open(cache))
    body = json.dumps({'image': base64.b64encode(open(path, 'rb').read()).decode()}).encode()
    req = urllib.request.Request(OCR_URL, data=body, headers={'Content-Type': 'application/json'})
    if os.environ.get('OCR_API_KEY'):
        req.add_header('X-OCR-Api-Key', os.environ['OCR_API_KEY'])
    t = time.time()
    try:
        reply = json.load(urllib.request.urlopen(req, timeout=900))
        error = reply.get('error')
    except Exception as e:  # recorded as a failed sheet, not a crash
        reply, error = {'lines': []}, str(e)
    result = {'seconds': round(time.time() - t, 2), 'lines': reply.get('lines', []), 'error': error}
    json.dump(result, open(cache, 'w'))
    return result


def box_of(poly):
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
    return [min(xs), min(ys), max(xs), max(ys)]


def overlap(a, b):
    w = min(a[2], b[2]) - max(a[0], b[0]); h = min(a[3], b[3]) - max(a[1], b[1])
    return max(0.0, w) * max(0.0, h)


def recognition(tokens, lines):
    """Per handwritten number: 'tp', 'fp' or 'fn'."""
    boxes = [(box_of(l['poly']), l['text']) for l in lines if l.get('poly')]
    outcome = []
    for t in tokens:
        g = t['box']
        area = max(1.0, (g[2] - g[0]) * (g[3] - g[1]))
        cands = [(overlap(g, b) / area, text) for b, text in boxes]
        cands = [c for c in cands if c[0] >= 0.3 and NUM.search(c[1])]
        if not cands:
            outcome.append('fn')
            continue
        _, text = max(cands)
        nums = [float(n) for n in NUM.findall(text)]
        outcome.append('tp' if float(t['text']) in nums else 'fp')
    return outcome


def prf(tp, fp, total):
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / total if total else 0.0
    f = 2 * p * r / (p + r) if p + r else 0.0
    return {'precision': round(p, 4), 'recall': round(r, 4), 'f1': round(f, 4), 'tp': tp, 'fp': fp, 'fn': total - tp, 'total': total}


def system_scores(items, workdir):
    inp, out = os.path.join(workdir, 'match-in.json'), os.path.join(workdir, 'match-out.json')
    json.dump(items, open(inp, 'w'))
    env = dict(os.environ, OCR_EVAL_IN=inp, OCR_EVAL_OUT=out)
    subprocess.run(['php', os.path.join(HERE, 'match.php')], cwd=BACKEND, env=env, check=True)
    return {r['id']: r for r in json.load(open(out))}


def load_real(folder):
    """ground_truth.csv: file,department,score (one row per college per photo)."""
    sheets = defaultdict(lambda: {'scores': {}, 'tokens': []})
    with open(os.path.join(folder, 'ground_truth.csv'), newline='') as f:
        for row in csv.DictReader(f):
            s = sheets[row['file']]
            s.update(id=os.path.splitext(row['file'])[0], image=row['file'], layout=row.get('sport', 'real'), condition=row.get('condition', 'real'))
            s['scores'][row['department'].strip()] = float(row['score'])
    for s in sheets.values():
        s['departments'] = list(s['scores'])
    return list(sheets.values())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--real', help='folder of real photos with ground_truth.csv')
    args = ap.parse_args()
    if args.real:
        folder = os.path.abspath(args.real); sheets = load_real(folder)
        out_dir = os.path.join(folder, 'results')
    else:
        set_dir = os.path.join(HERE, 'out', os.environ['OCR_SET']) if os.environ.get('OCR_SET') else os.path.join(HERE, 'out')
        folder = os.path.join(set_dir, 'sheets')
        sheets = [json.load(open(os.path.join(folder, f))) for f in sorted(os.listdir(folder)) if re.match(r'\d+-.*\.json$', f)]
        out_dir = os.path.join(set_dir, 'results')
    os.makedirs(out_dir, exist_ok=True)

    for n, s in enumerate(sheets):
        s['ocr'] = ocr(os.path.join(folder, s['image']), os.path.join(out_dir, f"{s['id']}.ocr.json"))
        print(f"\r{n + 1}/{len(sheets)} {s['id']}: {s['ocr']['seconds']}s, {len(s['ocr']['lines'])} lines      ", end='', flush=True)
    print()

    matched = system_scores([{'id': s['id'], 'departments': s['departments'], 'lines': s['ocr']['lines']} for s in sheets], out_dir)

    rows = []
    groups = defaultdict(lambda: {'rec': [], 'sys_tp': 0, 'sys_fp': 0, 'sys_total': 0, 'seconds': [], 'sheets': 0, 'sheets_all_right': 0})
    for s in sheets:
        rec = recognition(s['tokens'], s['ocr']['lines']) if s['tokens'] else []
        got = {x['department']: x['score'] for x in matched[s['id']]['scores']}
        tp = sum(1 for d, v in s['scores'].items() if d in got and float(got[d]) == float(v))
        fp = sum(1 for d, v in s['scores'].items() if d in got and float(got[d]) != float(v))
        for key in ('all', f"layout:{s['layout']}", f"condition:{s['condition']}"):
            g = groups[key]
            g['rec'] += rec; g['sys_tp'] += tp; g['sys_fp'] += fp; g['sys_total'] += len(s['scores'])
            g['seconds'].append(s['ocr']['seconds']); g['sheets'] += 1; g['sheets_all_right'] += int(tp == len(s['scores']))
        rows.append({
            'sheet': s['id'], 'layout': s['layout'], 'condition': s['condition'], 'ocr_seconds': s['ocr']['seconds'],
            'numbers': len(rec), 'numbers_read_right': rec.count('tp'),
            'expected': '; '.join(f'{d}={v:g}' for d, v in s['scores'].items()),
            'system_returned': '; '.join(f'{d}={v:g}' for d, v in got.items()) or '(none)',
            'scores_right': f'{tp}/{len(s["scores"])}', 'ocr_error': s['ocr'].get('error') or '',
        })

    summary = {}
    for key, g in groups.items():
        rec = g['rec']
        summary[key] = {
            'sheets': g['sheets'],
            'recognition': prf(rec.count('tp'), rec.count('fp'), len(rec)) if rec else None,
            'extraction': prf(g['sys_tp'], g['sys_fp'], g['sys_total']),
            'sheets_fully_correct': g['sheets_all_right'],
            'seconds': {'mean': round(statistics.mean(g['seconds']), 1), 'median': round(statistics.median(g['seconds']), 1),
                        'min': min(g['seconds']), 'max': max(g['seconds']),
                        'over_120s': sum(1 for x in g['seconds'] if x > 120)},
        }
    json.dump(summary, open(os.path.join(out_dir, 'summary.json'), 'w'), indent=2)
    with open(os.path.join(out_dir, 'sheets.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)

    a = summary['all']
    if a['recognition']:
        r = a['recognition']; print(f"Recognition  P={r['precision']:.3f} R={r['recall']:.3f} F1={r['f1']:.3f}  ({r['tp']}/{r['total']} numbers)")
    e = a['extraction']; print(f"Extraction   P={e['precision']:.3f} R={e['recall']:.3f} F1={e['f1']:.3f}  ({e['tp']}/{e['total']} college scores)")
    print(f"Sheets fully correct: {a['sheets_fully_correct']}/{a['sheets']}; OCR time mean {a['seconds']['mean']}s, max {a['seconds']['max']}s")
    print(f'Results: {os.path.relpath(out_dir)}')


if __name__ == '__main__':
    sys.exit(main())
