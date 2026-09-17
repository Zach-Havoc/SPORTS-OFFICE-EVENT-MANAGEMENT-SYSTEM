<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use thiagoalessio\TesseractOCR\TesseractOCR;

/**
 * OcrController
 *
 * Handles OCR (Optical Character Recognition) image processing for the
 * mobile scoring app's secondary scoring mode. A committee member/judge
 * photographs a physical score sheet, and this endpoint reads the single
 * overall total score (0-100, possibly with one decimal) off that sheet.
 *
 * Runs the real, self-hosted Tesseract OCR engine (the `tesseract` CLI on
 * this machine, wrapped by thiagoalessio/tesseract_ocr) against the
 * uploaded photo. Tesseract was chosen over a cloud vision API because it
 * needs no API key, no per-call cost, and no image data ever has to leave
 * this server — appropriate for a self-hosted event system.
 *
 * The extracted number is only ever a *starting suggestion*: the mobile app
 * always shows it to the judge on an editable "review" step with a visible
 * confidence percentage before it's submitted (see OCRScoreMapper.tsx), so
 * good-enough accuracy on a clear photo of a legible score sheet is the
 * bar here, not perfection on messy handwriting.
 */
class OcrController extends Controller
{
    /**
     * POST /api/ocr/extract
     *
     * Accept a base64-encoded image or multipart file upload, run OCR
     * against it, and return the single overall score read from the sheet.
     *
     * Request body:
     *   - image: string (base64) OR image_file: file upload
     *
     * Response (200 — a plausible score was read):
     *   {
     *     total_score: number,
     *     confidence: float (0-1),
     *     image_url: string|null,
     *     raw_text: string,
     *     is_mock: false
     *   }
     *
     * Response (422 — nothing plausible could be read from the image):
     *   {
     *     error: string,
     *     image_url: string|null,
     *     raw_text: string,
     *     is_mock: false
     *   }
     *   image_url is still populated here whenever the photo itself was a
     *   valid image (even though OCR couldn't make sense of it) — the photo
     *   is physical evidence of the paper score sheet and is always kept for
     *   the audit trail. Returning it on failure too means a judge who falls
     *   back to entering the score manually can still have that photo
     *   attached to the manual submission via ScoreController::store's
     *   optional `image_url` field, instead of the stored file becoming an
     *   orphan nothing ever references again.
     */
    public function extract(Request $request)
    {
        $request->validate([
            // Cap the raw base64 string too (~13.4MB base64 ≈ 10MB binary).
            'image' => 'required_without:image_file|nullable|string|max:14000000',
            'image_file' => 'required_without:image|file|image|max:10240',
        ]);

        $base64Image = null;
        if ($request->hasFile('image_file')) {
            $base64Image = base64_encode(file_get_contents($request->file('image_file')->getRealPath()));
        } elseif ($request->filled('image')) {
            $base64Image = $request->image;
        }

        // Decode once and reuse the bytes for both the audit-trail store and
        // the OCR pass below, rather than decoding the base64 payload twice.
        $decoded = $base64Image ? $this->decodeImage($base64Image) : null;

        // Store the image for the audit trail regardless of whether OCR can
        // later make sense of it — it's the physical evidence trail.
        $imageUrl = $decoded ? $this->storeImage($decoded['data']) : null;

        if (! $decoded) {
            return $this->unreadableResponse($imageUrl);
        }

        $rawText = $this->runTesseract($decoded['data']);

        if ($rawText === null) {
            return $this->unreadableResponse($imageUrl);
        }

        $parsed = $this->parseScore($rawText);

        if ($parsed === null) {
            return $this->unreadableResponse($imageUrl, $rawText);
        }

        return response()->json([
            'total_score' => $parsed['value'],
            'confidence' => $parsed['confidence'],
            'image_url' => $imageUrl,
            'raw_text' => $rawText,
            'is_mock' => false,
        ]);
    }

    /**
     * The shared "couldn't read a score" response. Matches the shape the
     * mobile app already expects and handles (OCRScoreMapper.tsx reads
     * `error.response?.data?.error` and offers "Try Again" / "Enter
     * Manually") — so this is a supported existing failure path, not a new
     * one being introduced here.
     */
    private function unreadableResponse(?string $imageUrl, ?string $rawText = null)
    {
        return response()->json([
            'error' => 'Could not read a score from this image. Try a clearer photo, or enter the score manually.',
            'image_url' => $imageUrl,
            'raw_text' => $rawText ?? '',
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

    /**
     * Run Tesseract against the decoded image bytes and return the raw
     * recognised text, or null if OCR could not be run at all (missing
     * binary, corrupt image data, etc). OCR failing here should never crash
     * the request — it just means we fall back to asking the human.
     */
    private function runTesseract(string $imageData): ?string
    {
        $tempPath = sys_get_temp_dir().'/ocr_'.Str::uuid()->toString().'.jpg';

        try {
            $im = @imagecreatefromstring($imageData);
            if ($im === false) {
                Log::warning('OCR: GD could not decode the image for OCR processing');

                return null;
            }

            // Grayscale is a cheap, well-known accuracy improvement for
            // photographed documents (strips colour/shadow noise before
            // Tesseract thresholds the image to black & white internally).
            imagefilter($im, IMG_FILTER_GRAYSCALE);
            imagejpeg($im, $tempPath, 90);
            imagedestroy($im);

            return (new TesseractOCR($tempPath))
                // PSM 6 = "assume a single uniform block of text". A
                // photographed scoresheet is a busy form, not an isolated
                // digit or a full multi-column page, so this reads better
                // than the single-word/line modes (7/8) or the default
                // full-page-layout mode (3) — confirmed against real
                // generated sample images (see OcrTest) before picking it.
                ->psm(6)
                // Never let Tesseract guess at letters — we only ever want
                // digits and a decimal point out of this.
                ->allowlist('0123456789.')
                ->run();
        } catch (\Throwable $e) {
            Log::warning('OCR tesseract run failed: '.$e->getMessage());

            return null;
        } finally {
            if (file_exists($tempPath)) {
                @unlink($tempPath);
            }
        }
    }

    /**
     * Parse Tesseract's raw text into a single best-guess score.
     *
     * The raw text from a full scoresheet photo is often noisy even with
     * the digit whitelist (other numbers on the form, OCR splitting/merging
     * digits across lines, stray marks read as "1" or ".", etc). We pull out
     * every substring that looks like a plausible score, keep only the ones
     * in the valid 0-100 range, and then:
     *   - 0 candidates  -> null (caller returns the 422 "couldn't read" case)
     *   - 1 candidate   -> that's the answer, high confidence (0.85)
     *   - 2+ candidates -> ambiguous. We guess the reading with the most
     *     digits is the real total (a deliberate multi-digit total like
     *     "87.5" is more likely to be it than a stray single digit picked up
     *     elsewhere on the form), breaking ties by first occurrence, but we
     *     report much lower confidence (0.5) since it's genuinely a guess
     *     among several options. This heuristic is not foolproof — e.g. two
     *     unrelated numbers OCR'd back-to-back without a space can look like
     *     one long number and outrank the real total — but with no
     *     surviving textual context (the digit whitelist strips labels like
     *     "TOTAL") there's no more reliable signal available here, and any
     *     wrong guess is still just a starting point the judge reviews and
     *     can correct before it's submitted.
     *
     * @return array{value: float, confidence: float}|null
     */
    private function parseScore(string $rawText): ?array
    {
        preg_match_all('/\d{1,3}(?:\.\d{1,2})?/', $rawText, $matches);

        $candidates = [];
        foreach ($matches[0] as $raw) {
            $value = (float) $raw;
            if ($value >= 0 && $value <= 100) {
                $candidates[] = ['raw' => $raw, 'value' => $value];
            }
        }

        if ($candidates === []) {
            return null;
        }

        if (count($candidates) === 1) {
            return ['value' => $candidates[0]['value'], 'confidence' => 0.85];
        }

        usort($candidates, function ($a, $b) {
            return strlen(str_replace('.', '', $b['raw'])) <=> strlen(str_replace('.', '', $a['raw']));
        });

        return ['value' => $candidates[0]['value'], 'confidence' => 0.5];
    }
}
