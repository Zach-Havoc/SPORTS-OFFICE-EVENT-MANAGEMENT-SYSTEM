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
            'image'    => 'required_without:image_file|string',
            'image_file' => 'required_without:image|file|image|max:10240',
            'criteria' => 'sometimes|array',
        ]);

        // ─────────────────────────────────────────────────────────────
        // TODO: Replace with real OCR integration
        //
        // Example with Google Cloud Vision:
        //   $imageContent = base64_decode($request->image);
        //   $imageAnnotator = new ImageAnnotatorClient();
        //   $image = (new Image())->setContent($imageContent);
        //   $response = $imageAnnotator->textDetection($image);
        //   $text = $response->getTextAnnotations()[0]->getDescription();
        //   // Then parse $text to extract score labels and values
        // ─────────────────────────────────────────────────────────────

        // MVP Mock: Parse criteria hints and return plausible mock scores
        $criteria = $request->input('criteria', []);

        if (empty($criteria)) {
            // Generic fallback when no criteria hints provided
            return response()->json([
                'extracted_scores' => [
                    ['label' => 'Score 1', 'value' => 8.5],
                    ['label' => 'Score 2', 'value' => 7.0],
                ],
                'confidence' => 0.72,
                'raw_text'   => 'Mock OCR output — replace with real OCR service',
                'is_mock'    => true,
            ]);
        }

        // Simulate extracting one score per criterion
        $extractedScores = collect($criteria)->map(function ($criterion) {
            $maxScore = $criterion['max_score'] ?? 10;
            // Mock: return a random value within the valid range
            $mockValue = round(mt_rand((int)($maxScore * 50), (int)($maxScore * 100)) / 100, 1);
            return [
                'label'       => $criterion['name'] ?? 'Unknown',
                'criteria_id' => $criterion['criteria_id'] ?? null,
                'value'       => min($mockValue, $maxScore),
            ];
        })->values()->toArray();

        return response()->json([
            'extracted_scores' => $extractedScores,
            'confidence'       => 0.85,
            'raw_text'         => 'Mock OCR output — wire to real OCR service in production',
            'is_mock'          => true,
        ]);
    }

    /**
     * Store the OCR-captured image for score audit trail.
     * Called internally after extraction — not a route endpoint.
     */
    private function storeImage(string $base64Image): ?string
    {
        try {
            $imageData = base64_decode($base64Image);
            $filename  = 'ocr_captures/' . uniqid('ocr_', true) . '.jpg';
            \Storage::disk('public')->put($filename, $imageData);
            return \Storage::disk('public')->url($filename);
        } catch (\Exception $e) {
            return null;
        }
    }
}
