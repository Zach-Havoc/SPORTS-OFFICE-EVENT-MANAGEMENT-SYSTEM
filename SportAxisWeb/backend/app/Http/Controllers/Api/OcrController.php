<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

/**
 * OcrController
 *
 * Handles OCR (Optical Character Recognition) image processing for the
 * mobile judge app's secondary scoring mode. Judges can photograph a
 * physical score sheet, and this endpoint extracts the scores.
 *
 * MVP: Returns mock extracted scores.
 * Production: Wire to Google Cloud Vision API or Azure Computer Vision.
 */
class OcrController extends Controller
{
    /**
     * POST /api/ocr/extract
     *
     * Accept a base64-encoded image or multipart file upload,
     * process it with OCR, and return extracted score labels + values.
     *
     * Request body:
     *   - image: string (base64) OR file upload
     *   - criteria: array (optional, for label matching hints)
     *
     * Response:
     *   {
     *     extracted_scores: [{ label: string, value: number }],
     *     confidence: float (0-1),
     *     raw_text: string (optional debug)
     *   }
     */
    public function extract(Request $request)
    {
        $request->validate([
            'image'      => 'required_without:image_file|nullable|string',
            'image_file' => 'required_without:image|file|image|max:10240',
            'criteria'   => 'sometimes|array',
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

        $criteria = $request->input('criteria', []);

        if (empty($criteria)) {
            return response()->json([
                'extracted_scores' => [
                    ['label' => 'Score 1', 'value' => 8.5],
                    ['label' => 'Score 2', 'value' => 7.0],
                ],
                'confidence' => 0.88,
                'image_url'  => $imageUrl,
                'raw_text'   => 'Extracted text from score sheet image',
            ]);
        }

        $extractedScores = collect($criteria)->map(function ($criterion) {
            $maxScore = (float)($criterion['max_score'] ?? 10);
            $mockValue = round(mt_rand((int)($maxScore * 65), (int)($maxScore * 95)) / 100, 1);
            return [
                'label'       => $criterion['name'] ?? 'Unknown',
                'criteria_id' => $criterion['criteria_id'] ?? null,
                'value'       => min($mockValue, $maxScore),
            ];
        })->values()->toArray();

        return response()->json([
            'extracted_scores' => $extractedScores,
            'confidence'       => 0.91,
            'image_url'        => $imageUrl,
            'raw_text'         => 'Extracted score sheet metrics successfully.',
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
            $imageData = base64_decode($base64Image);
            if (!$imageData) return null;

            $filename = 'ocr_captures/' . uniqid('ocr_', true) . '.jpg';
            \Storage::disk('public')->put($filename, $imageData);
            return asset('storage/' . $filename);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('OCR storeImage error: ' . $e->getMessage());
            return null;
        }
    }
}
