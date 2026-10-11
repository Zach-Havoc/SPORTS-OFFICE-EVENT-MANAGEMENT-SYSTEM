<?php

/*
 * Runs the system's own OCR score matching (OcrScoreMatcher, as
 * OcrController calls it) on saved OCR output, so the accuracy test measures
 * exactly what SportAxis does without running the OCR model twice. Used by
 * evaluate.py:
 *
 *   OCR_EVAL_IN=in.json OCR_EVAL_OUT=out.json php e2e/ocr-accuracy/match.php
 *
 * in.json:  [{"id": "...", "departments": [...], "lines": <OCR service "lines">}]
 * out.json: [{"id": "...", "scores": [{"department", "score", "confidence"}], "notes": "..."}]
 */

$backend = __DIR__.'/../../backend';
require $backend.'/vendor/autoload.php';
$app = require $backend.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$matcher = app(\App\Services\OcrScoreMatcher::class);
$items = json_decode(file_get_contents(getenv('OCR_EVAL_IN')), true);
$results = [];
foreach ($items as $item) {
    // The same line shape and short-name lookup as OcrController::extract().
    $lines = collect($item['lines'])
        ->filter(fn ($l) => is_array($l) && is_string($l['text'] ?? null))
        ->map(fn ($l) => [
            'text' => $l['text'],
            'confidence' => is_numeric($l['confidence'] ?? null) ? (float) $l['confidence'] : 0.5,
            'poly' => $l['poly'] ?? null,
        ])->values()->all();
    $abbreviations = \App\Models\Department::whereIn('name', $item['departments'])
        ->whereNotNull('abbreviation')
        ->pluck('abbreviation', 'name')
        ->all();

    [$scores, $notes] = $matcher->match($lines, $item['departments'], $abbreviations);
    $results[] = ['id' => $item['id'], 'scores' => $scores, 'notes' => $notes];
}

file_put_contents(getenv('OCR_EVAL_OUT'), json_encode($results, JSON_PRETTY_PRINT));
echo 'matched '.count($results)." sheets\n";
