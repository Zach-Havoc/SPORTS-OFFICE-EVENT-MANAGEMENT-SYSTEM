<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * OcrController
 *
 * Handles OCR (Optical Character Recognition) image processing for the
 * mobile scoring app's secondary scoring mode. A committee member can
 * photograph a physical score sheet, and this endpoint extracts the
 * overall score for the team being scored.
 *
 * MVP: Returns a mock extracted total.
 * Production: Wire to Google Cloud Vision API or Azure Computer Vision.
 */
class OcrController extends Controller
{
    /**
     * POST /api/ocr/extract
     *
     * Accept a base64-encoded image or multipart file upload, process it
     * with OCR, and return the single overall score read from the sheet.
     *
     * Request body:
     *   - image: string (base64) OR image_file: file upload
     *
     * Response:
     *   {
     *     total_score: number,
     *     confidence: float (0-1),
     *     image_url: string|null,
     *     raw_text: string (optional debug)
     *   }
     */
    public function extract(Request $request)
    {
        $request->validate([
            // Cap the raw base64 string too (~13.4MB base64 ≈ 10MB binary).
            'image'      => 'required_without:image_file|nullable|string|max:14000000',
            'image_file' => 'required_without:image|file|image|max:10240',
        ]);

        $base64Image = null;
        if ($request->hasFile('image_file')) {
            $base64Image = base64_encode(file_get_contents($request->file('image_file')->getRealPath()));
        } elseif ($request->filled('image')) {
            $base64Image = $request->image;
        }

        // Store image for audit trail and retrieve public URL
        $imageUrl = null;
        if ($base64Image) {
            $imageUrl = $this->storeImage($base64Image);
        }

        return response()->json([
            'total_score' => round(mt_rand(6500, 9500) / 100, 1),
            'confidence'  => 0.9,
            'image_url'   => $imageUrl,
            'raw_text'    => 'Extracted overall score from score sheet image.',
        ]);
    }

    /**
     * Store the OCR-captured image for score audit trail.
     */
    private function storeImage(string $base64Image): ?string
    {
        try {
            if (preg_match('/^data:image\/(\w+);base64,/', $base64Image)) {
                $base64Image = substr($base64Image, strpos($base64Image, ',') + 1);
            }
            $imageData = base64_decode($base64Image, true);
            if (!$imageData) return null;

            // Ensure the decoded bytes are actually a real raster image before
            // writing to the public disk. Without this an attacker could store
            // HTML/SVG/script content and serve stored XSS from our origin.
            $info = @getimagesizefromstring($imageData);
            $allowed = [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_GIF, IMAGETYPE_WEBP];
            if ($info === false || !in_array($info[2] ?? null, $allowed, true)) {
                \Illuminate\Support\Facades\Log::warning('OCR storeImage rejected non-image payload');
                return null;
            }

            if (strlen($imageData) > 10 * 1024 * 1024) {
                return null;
            }

            $filename = 'ocr_captures/' . Str::uuid() . '.jpg';
            \Storage::disk('public')->put($filename, $imageData);
            return asset('storage/' . $filename);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('OCR storeImage error: ' . $e->getMessage());
            return null;
        }
    }
}
