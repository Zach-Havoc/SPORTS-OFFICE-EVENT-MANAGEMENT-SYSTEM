<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * POST /api/ocr/extract  (any authenticated user)
 *
 * Runs real Tesseract OCR (no mocking of the OCR engine) against images
 * generated at runtime with GD. Security focus is unchanged from before:
 * the stored audit image must actually be a raster image (base64 payloads
 * that aren't an image are rejected and not written to disk).
 */
class OcrTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    /** A real JPEG, legibly showing $text as large black digits on white, base64-encoded. */
    private function scoreImageBase64(string $text): string
    {
        $width = 400;
        $height = 200;
        $im = imagecreatetruecolor($width, $height);
        $white = imagecolorallocate($im, 255, 255, 255);
        $black = imagecolorallocate($im, 0, 0, 0);
        imagefilledrectangle($im, 0, 0, $width, $height, $white);

        $font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
        if (is_file($font)) {
            imagettftext($im, 60, 0, 50, 130, $black, $font, $text);
        } else {
            // Fall back to GD's built-in bitmap font if no TTF is installed
            // on this machine — smaller, but still legible to Tesseract.
            imagestring($im, 5, 150, 90, $text, $black);
        }

        ob_start();
        imagejpeg($im, null, 95);
        $bytes = (string) ob_get_clean();
        imagedestroy($im);

        return base64_encode($bytes);
    }

    /** A real, valid PNG with no text at all — nothing for Tesseract to read. */
    private function blankImageBase64(): string
    {
        $im = imagecreatetruecolor(200, 200);
        $white = imagecolorallocate($im, 255, 255, 255);
        imagefilledrectangle($im, 0, 0, 200, 200, $white);
        ob_start();
        imagepng($im);
        $bytes = (string) ob_get_clean();
        imagedestroy($im);

        return base64_encode($bytes);
    }

    public function test_ocr_requires_authentication(): void
    {
        $this->postJson('/api/ocr/extract', ['image' => 'x'])->assertUnauthorized();
    }

    public function test_ocr_extracts_a_clear_legible_score_from_a_real_image(): void
    {
        $this->actingAsRole('judge');

        $response = $this->postJson('/api/ocr/extract', ['image' => $this->scoreImageBase64('92')])
            ->assertOk()
            ->assertJsonStructure(['total_score', 'confidence', 'image_url', 'raw_text', 'is_mock']);

        $response->assertJsonPath('is_mock', false);

        $totalScore = (float) $response->json('total_score');
        $confidence = (float) $response->json('confidence');

        // A single, large, legible number on a blank background is the easy
        // case for Tesseract — assert it actually reads it correctly, not
        // just "some number in range".
        $this->assertSame(92.0, $totalScore);
        $this->assertGreaterThan(0, $confidence);
    }

    public function test_ocr_extracts_a_decimal_score_from_a_real_image(): void
    {
        $this->actingAsRole('judge');

        $response = $this->postJson('/api/ocr/extract', ['image' => $this->scoreImageBase64('87.5')])
            ->assertOk();

        $this->assertSame(87.5, (float) $response->json('total_score'));
        $this->assertGreaterThan(0, (float) $response->json('confidence'));
        $this->assertFalse($response->json('is_mock'));
    }

    public function test_ocr_returns_422_when_no_score_can_be_read(): void
    {
        $this->actingAsRole('judge');

        $response = $this->postJson('/api/ocr/extract', ['image' => $this->blankImageBase64()])
            ->assertStatus(422)
            ->assertJsonStructure(['error', 'image_url']);

        $this->assertNotEmpty($response->json('error'));
    }

    public function test_the_image_is_still_stored_for_the_audit_trail_when_ocr_cannot_read_it(): void
    {
        $this->actingAsRole('judge');

        $response = $this->postJson('/api/ocr/extract', ['image' => $this->blankImageBase64()])
            ->assertStatus(422);

        // The photo is kept even though OCR found nothing usable — it's the
        // physical evidence trail, and the URL is returned so a manual score
        // entry can still reference it instead of orphaning the file.
        $this->assertNotNull($response->json('image_url'));
        $this->assertNotEmpty(Storage::disk('public')->files('ocr_captures'));
    }

    public function test_a_non_image_base64_payload_is_not_stored(): void
    {
        $this->actingAsRole('judge');

        $this->postJson('/api/ocr/extract', ['image' => 'this-is-not-an-image'])
            ->assertStatus(422)
            ->assertJsonPath('image_url', null);

        // Nothing was written to the public disk.
        $this->assertEmpty(Storage::disk('public')->allFiles());
    }

    public function test_a_valid_base64_image_is_persisted_for_the_audit_trail(): void
    {
        $this->actingAsRole('judge');

        $url = $this->postJson('/api/ocr/extract', ['image' => $this->scoreImageBase64('92')])
            ->assertOk()
            ->json('image_url');

        $this->assertNotNull($url);
        $this->assertNotEmpty(Storage::disk('public')->files('ocr_captures'));
    }

    public function test_an_uploaded_non_image_file_is_rejected_by_validation(): void
    {
        $this->actingAsRole('judge');

        $this->post('/api/ocr/extract', [
            'image_file' => UploadedFile::fake()->create('notes.pdf', 10, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('image_file');
    }
}
