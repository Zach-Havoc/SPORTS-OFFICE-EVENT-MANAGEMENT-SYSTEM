<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * POST /api/ocr/extract  (any authenticated user)
 *
 * MVP endpoint that returns a mock overall score. Security focus: the stored
 * audit image must actually be a raster image (base64 payloads that aren't an
 * image are rejected and not written to disk).
 */
class OcrTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    /** Real PNG bytes, base64-encoded — generated in-process so there's no temp file to lose. */
    private function pngBase64(): string
    {
        $img = imagecreatetruecolor(40, 40);
        ob_start();
        imagepng($img);
        $bytes = (string) ob_get_clean();
        imagedestroy($img);

        return base64_encode($bytes);
    }

    public function test_ocr_requires_authentication(): void
    {
        $this->postJson('/api/ocr/extract', ['image' => 'x'])->assertUnauthorized();
    }

    public function test_ocr_returns_a_mock_total_for_a_valid_image(): void
    {
        $this->actingAsRole('judge');

        $this->postJson('/api/ocr/extract', ['image' => $this->pngBase64()])
            ->assertOk()
            ->assertJsonStructure(['total_score', 'confidence', 'image_url']);
    }

    public function test_a_non_image_base64_payload_is_not_stored(): void
    {
        $this->actingAsRole('judge');

        $this->postJson('/api/ocr/extract', ['image' => 'this-is-not-an-image'])
            ->assertOk()
            ->assertJsonPath('image_url', null); // rejected by storeImage()

        // Nothing was written to the public disk.
        $this->assertEmpty(Storage::disk('public')->allFiles());
    }

    public function test_a_valid_base64_image_is_persisted_for_the_audit_trail(): void
    {
        $this->actingAsRole('judge');

        $url = $this->postJson('/api/ocr/extract', ['image' => $this->pngBase64()])
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
