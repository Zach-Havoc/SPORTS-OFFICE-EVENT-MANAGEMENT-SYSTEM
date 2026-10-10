<?php

/*
 * Runs the system's own OCR score matching (OcrController) on saved OCR
 * output, so the accuracy test measures exactly what SportAxis does without
 * running the OCR model twice. Used by evaluate.py:
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

$controller = app(\App\Http\Controllers\Api\OcrController::class);
$call = function (string $method, ...$args) use ($controller) {
    $m = new ReflectionMethod($controller, $method);
    $m->setAccessible(true);

    return $m->invoke($controller, ...$args);
};

$items = json_decode(file_get_contents(getenv('OCR_EVAL_IN')), true);
$results = [];
foreach ($items as $item) {
    // The same normalisation callOcrService() applies to the service's reply.
    $lines = collect($item['lines'])
        ->filter(fn ($l) => is_array($l) && is_string($l['text'] ?? null))
        ->map(function ($l) use ($call) {
            [$y1, $y2] = $call('verticalBounds', $l['poly'] ?? null);

            return [
                'text' => $l['text'],
                'confidence' => is_numeric($l['confidence'] ?? null) ? (float) $l['confidence'] : 0.5,
                'y1' => $y1,
                'y2' => $y2,
                'x1' => $call('horizontalStart', $l['poly'] ?? null),
            ];
        })->values()->all();

    [$scores, $notes] = $call('matchScoresToDepartments', $lines, $item['departments']);
    $results[] = ['id' => $item['id'], 'scores' => $scores, 'notes' => $notes];
}

file_put_contents(getenv('OCR_EVAL_OUT'), json_encode($results, JSON_PRETTY_PRINT));
echo 'matched '.count($results)." sheets\n";
