<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * OcrController
 *
 * Handles OCR (Optical Character Recognition) image processing for the
 * mobile scoring app's secondary scoring mode. A committee member/judge
 * photographs a physical score sheet, and this endpoint reads every
 * competing college/department's score off that one sheet in a single pass.
 *
 * Engine: a local, self-hosted PaddleOCR service (see OCR/service.py in the
 * repo root — must be running separately, OCR/start.sh) — free, no API key,
 * no per-image cost, no data ever leaving this server. Chosen after ruling
 * out Tesseract (too unreliable on handwriting) and a cloud vision model
 * (real per-image cost, no budget for it).
 *
 * The tradeoff versus a vision-AI model: PaddleOCR only reads text, it does
 * not understand the document. It has no idea which number belongs to which
 * college — this controller works that out itself. Real printed scoresheets
 * put a college's name and its score in separate table cells (same row,
 * different column), not one sentence, so the matching is row-aware: find
 * the line with the college's name, then look across every other detected
 * line sitting on that same row (by vertical position) for the first
 * plausible number — see matchScoresToDepartments(). A scoresheet where OCR
 * misreads the name entirely, or where nothing on that row is a readable
 * number, simply won't get a match for that college — which is the same
 * "don't guess" principle the rest of this endpoint follows: no number is
 * invented for a college nothing could be tied to.
 *
 * The extracted numbers are only ever a *starting suggestion*: the mobile
 * app always shows them to the judge on an editable "review" step with a
 * visible confidence percentage before they're submitted (see
 * OCRScoreMapper.tsx), so good-enough accuracy on a clear photo of a
 * legible score sheet is the bar here, not perfection on messy handwriting.
 */
class OcrController extends Controller
{
    /**
     * POST /api/ocr/extract
     *
     * Accept a base64-encoded image or multipart file upload, plus the list
     * of department/college names competing in this match, and try to read
     * each of those colleges' scores off the single sheet.
     *
     * Request body:
     *   - image: string (base64) OR image_file: file upload
     *   - departments: array<string> (required) — the exact college/department
     *     name strings competing in this event. Sent either as a real array
     *     field or, in a multipart form, as a JSON-encoded string under the
     *     same key.
     *
     * Response (200):
     *   { scores: [ { department, score, confidence }, ... ], image_url, notes, is_mock: false }
     * Response (422 — OCR service unreachable, or nothing legible/matchable found):
     *   { error, image_url, scores: [], is_mock: false }
     */
    public function extract(Request $request)
    {
        $request->validate([
            'image' => 'required_without:image_file|nullable|string|max:14000000',
            'image_file' => 'required_without:image|file|image|max:10240',
        ]);

        $departments = $this->resolveDepartments($request);
        $this->validateDepartments($departments);

        $base64Image = null;
        if ($request->hasFile('image_file')) {
            $base64Image = base64_encode(file_get_contents($request->file('image_file')->getRealPath()));
        } elseif ($request->filled('image')) {
            $base64Image = $request->image;
        }

        $decoded = $base64Image ? $this->decodeImage($base64Image) : null;

        // Store the image for the audit trail regardless of whether
        // extraction can later make sense of it — it's the physical
        // evidence trail.
        $imageUrl = $decoded ? $this->storeImage($decoded['data']) : null;

        if (! $decoded) {
            return $this->unreadableResponse(
                $imageUrl,
                'Could not read this image. Try a clearer photo, or enter the scores manually.'
            );
        }

        try {
            $lines = $this->callOcrService($decoded['data']);
        } catch (\Throwable $e) {
            Log::error('OCR service call failed: '.$e->getMessage());

            return $this->unreadableResponse(
                $imageUrl,
                'The OCR service is unavailable right now. Enter the scores manually.'
            );
        }

        if ($lines === null) {
            return $this->unreadableResponse(
                $imageUrl,
                'Could not read this image. Try a clearer photo, or enter the scores manually.'
            );
        }

        [$scores, $notes] = $this->matchScoresToDepartments($lines, $departments);

        if ($scores === []) {
            return $this->unreadableResponse(
                $imageUrl,
                'Could not match any college name on the sheet to a score. Try a clearer photo, or enter the scores manually.'
            );
        }

        return response()->json([
            'scores' => $scores,
            'image_url' => $imageUrl,
            'notes' => $notes,
            'is_mock' => false,
        ]);
    }

    /**
     * Support both a real array field and a JSON-encoded string under the
     * same key (how a multipart form has to send an array).
     *
     * @return array<int, string>
     */
    private function resolveDepartments(Request $request): array
    {
        $departments = $request->input('departments');

        if (is_string($departments)) {
            $decoded = json_decode($departments, true);

            return is_array($decoded) ? $decoded : [$departments];
        }

        return is_array($departments) ? $departments : [];
    }

    private function validateDepartments(array $departments): void
    {
        \Validator::make(
            ['departments' => $departments],
            ['departments' => 'required|array|min:1|max:20', 'departments.*' => 'string']
        )->validate();
    }

    /**
     * Call the local PaddleOCR service and return every text line it found,
     * or null if the service couldn't be reached / returned nothing useful.
     *
     * @return array<int, array{text: string, confidence: float}>|null
     */
    private function callOcrService(string $imageData): ?array
    {
        $url = rtrim((string) config('services.ocr.url'), '/').'/extract';

        // PaddleOCR runs on CPU with no hardware acceleration (see
        // OCR/service.py's enable_mkldnn note) — a single real score-sheet
        // photo has measured well over 60s, so a short timeout here doesn't
        // protect anything, it just turns a slow-but-working extraction into
        // a guaranteed failure.
        $apiKey = config('services.ocr.api_key');

        $response = Http::timeout(120)
            ->when($apiKey, fn ($http) => $http->withHeaders(['X-OCR-Api-Key' => $apiKey]))
            ->post($url, [
                'image' => base64_encode($imageData),
            ]);

        if (! $response->successful()) {
            Log::warning('OCR service returned a non-2xx response', ['status' => $response->status()]);

            return null;
        }

        $lines = $response->json('lines');
        if (! is_array($lines)) {
            return null;
        }

        return collect($lines)
            ->filter(fn ($l) => is_array($l) && is_string($l['text'] ?? null))
            ->map(function ($l) {
                $line = [
                    'text' => $l['text'],
                    'confidence' => is_numeric($l['confidence'] ?? null) ? (float) $l['confidence'] : 0.5,
                ];
                $bounds = $this->verticalBounds($l['poly'] ?? null);
                $line['y1'] = $bounds[0];
                $line['y2'] = $bounds[1];
                $line['x1'] = $this->horizontalStart($l['poly'] ?? null);

                return $line;
            })
            ->values()
            ->all();
    }

    /**
     * The min/max Y coordinate of a detected line's bounding polygon
     * (`[[x,y], [x,y], ...]`), or `[null, null]` if it's missing/malformed —
     * used to tell whether two lines sit on the same table row. Falls back
     * to treating a line with no position data as never overlapping anything
     * (it can still be matched by text, just not by row).
     *
     * @return array{0: float|null, 1: float|null}
     */
    private function verticalBounds($poly): array
    {
        if (! is_array($poly) || $poly === []) {
            return [null, null];
        }

        $ys = array_map(fn ($p) => (float) ($p[1] ?? 0), $poly);

        return [min($ys), max($ys)];
    }

    private function horizontalStart($poly): ?float
    {
        if (! is_array($poly) || $poly === []) {
            return null;
        }

        return min(array_map(fn ($p) => (float) ($p[0] ?? 0), $poly));
    }

    /** Two lines are "the same table row" if their vertical spans overlap at all. */
    private function sameRow(array $a, array $b): bool
    {
        if ($a['y1'] === null || $a['y2'] === null || $b['y1'] === null || $b['y2'] === null) {
            return false;
        }

        return $a['y1'] <= $b['y2'] && $b['y1'] <= $a['y2'];
    }

    /**
     * Look for each requested department's name among the recognised text
     * lines (case-insensitive substring match — good enough since these are
     * short, specific college names, not ambiguous common words). A real,
     * printed scoresheet almost always has the college's name and its score
     * in *separate table cells* — same row, different column — not one
     * sentence, so a plain "does this line contain both the name and a
     * number" check misses nearly every real sheet. Instead: once a
     * department's name-line is found, first check that same line for a
     * number (covers a sheet that really does write "Team: 87" together),
     * and if there isn't one, look at every OTHER line sitting on the same
     * row (overlapping vertical position) and take the first one with a
     * plausible score — that's the adjacent cell.
     *
     * A department whose name isn't found anywhere, or whose row has no
     * readable number anywhere on it, is simply left out of the result —
     * never guessed.
     *
     * @param  array<int, array{text: string, confidence: float, y1: ?float, y2: ?float, x1: ?float}>  $lines
     * @param  array<int, string>  $departments
     * @return array{0: array<int, array{department: string, score: float, confidence: float}>, 1: string}
     */
    private function matchScoresToDepartments(array $lines, array $departments): array
    {
        $scores = [];
        $unmatched = [];

        foreach ($departments as $department) {
            $nameLine = null;

            foreach ($lines as $line) {
                if (trim($department) !== '' && $this->lineMatchesDepartment($line['text'], $department)) {
                    $nameLine = $line;
                    break;
                }
            }

            if ($nameLine === null) {
                $unmatched[] = $department;

                continue;
            }

            // Same line first (handles "Team: 87" written as one sentence).
            $number = $this->firstPlausibleScore($nameLine['text']);
            $confidence = $nameLine['confidence'];

            // Otherwise, the same row's other cells — sorted left to right,
            // since these templates always print the name first and the
            // score in a column after it.
            if ($number === null) {
                $rowMates = collect($lines)
                    ->filter(fn ($l) => $l !== $nameLine && $this->sameRow($nameLine, $l))
                    ->sortBy('x1')
                    ->values();

                foreach ($rowMates as $mate) {
                    $found = $this->firstPlausibleScore($mate['text']);
                    if ($found !== null) {
                        $number = $found;
                        $confidence = $mate['confidence'];
                        break;
                    }
                }
            }

            if ($number === null) {
                $unmatched[] = $department;

                continue;
            }

            $scores[] = [
                'department' => $department,
                'score' => $number,
                'confidence' => $confidence,
            ];
        }

        $notes = $unmatched === []
            ? ''
            : 'Could not find a score for: '.implode(', ', $unmatched).'.';

        return [$scores, $notes];
    }

    /**
     * Word-by-word fuzzy match, tolerant of the odd single-character OCR
     * misread ("Sclences" for "Sciences") that would defeat a plain
     * str_contains() check outright. Every word in the department name must
     * have a close match somewhere in the line; short (<=3 letter) words —
     * "of", "and" — must match exactly, since fuzzy matching those causes
     * false positives (nearly anything is "close" to a 2-3 letter word).
     */
    private function lineMatchesDepartment(string $lineText, string $department): bool
    {
        $deptWords = $this->normalizedWords($department);
        if ($deptWords === []) {
            return false;
        }

        $lineWords = $this->normalizedWords($lineText);

        foreach ($deptWords as $deptWord) {
            $hasMatch = false;
            foreach ($lineWords as $lineWord) {
                if ($this->wordsAreClose($deptWord, $lineWord)) {
                    $hasMatch = true;
                    break;
                }
            }
            if (! $hasMatch) {
                return false;
            }
        }

        return true;
    }

    /** @return array<int, string> */
    private function normalizedWords(string $text): array
    {
        $clean = (string) preg_replace('/[^a-z0-9\s]/', ' ', mb_strtolower($text));

        return array_values(array_filter(preg_split('/\s+/', trim($clean)) ?: []));
    }

    private function wordsAreClose(string $a, string $b): bool
    {
        if ($a === $b) {
            return true;
        }

        if (mb_strlen($a) <= 3 || mb_strlen($b) <= 3) {
            return false;
        }

        // Roughly 1 tolerated edit per 6 characters — enough to absorb a
        // single misread letter on a real college-name-length word without
        // starting to match genuinely different words.
        $maxLen = max(mb_strlen($a), mb_strlen($b));

        return levenshtein($a, $b) <= max(1, (int) floor($maxLen / 6));
    }

    /** Pull the first 0-100 numeric substring out of a line of text. */
    private function firstPlausibleScore(string $text): ?float
    {
        if (! preg_match_all('/\d{1,3}(?:\.\d{1,2})?/', $text, $matches)) {
            return null;
        }

        foreach ($matches[0] as $raw) {
            $value = (float) $raw;
            if ($value >= 0 && $value <= 100) {
                return $value;
            }
        }

        return null;
    }

    private function unreadableResponse(?string $imageUrl, string $error)
    {
        return response()->json([
            'error' => $error,
            'image_url' => $imageUrl,
            'scores' => [],
            'is_mock' => false,
        ], 422);
    }

    /**
     * Strip a data URI prefix if present, base64-decode, and confirm the
     * bytes are actually a real raster image before doing anything else with
     * them. Without this an attacker could submit HTML/SVG/script content
     * and have it served back as stored XSS from our own storage origin.
     *
     * @return array{data: string, type: int}|null
     */
    private function decodeImage(string $base64Image): ?array
    {
        if (preg_match('/^data:image\/(\w+);base64,/', $base64Image)) {
            $base64Image = substr($base64Image, strpos($base64Image, ',') + 1);
        }

        $imageData = base64_decode($base64Image, true);
        if (! $imageData) {
            return null;
        }

        $info = @getimagesizefromstring($imageData);
        $allowed = [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_GIF, IMAGETYPE_WEBP];
        if ($info === false || ! in_array($info[2] ?? null, $allowed, true)) {
            Log::warning('OCR decodeImage rejected non-image payload');

            return null;
        }

        if (strlen($imageData) > 10 * 1024 * 1024) {
            return null;
        }

        return ['data' => $imageData, 'type' => $info[2]];
    }

    /**
     * Store the OCR-captured image for score audit trail.
     */
    private function storeImage(string $imageData): ?string
    {
        try {
            $filename = 'ocr_captures/'.Str::uuid().'.jpg';
            \Storage::disk('public')->put($filename, $imageData);

            return asset('storage/'.$filename);
        } catch (\Exception $e) {
            Log::error('OCR storeImage error: '.$e->getMessage());

            return null;
        }
    }
}
