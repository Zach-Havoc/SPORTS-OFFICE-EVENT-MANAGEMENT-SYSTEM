<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * POST /api/ocr/extract  (any authenticated user)
 *
 * The endpoint calls a local, self-hosted PaddleOCR service (OCR/service.py
 * in the repo root — free, no API key, no per-image cost) instead of a paid
 * vision-AI model. That service only reads text out of an image; it has no
 * idea which line is which college's score, so OcrController matches each
 * requested department's name against the recognised text lines itself and
 * pulls a number from whichever line contains that name. We never call the
 * real local service in tests — Http::fake() stands in for it.
 *
 * Security focus is unchanged from earlier versions: the stored audit image
 * must actually be a raster image (base64 payloads that aren't an image are
 * rejected and not written to disk).
 */
class OcrTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        config(['services.ocr.url' => 'http://127.0.0.1:5001']);
    }

    /** A real, valid JPEG (contents don't matter — the OCR service is faked). */
    private function imageBase64(): string
    {
        $im = imagecreatetruecolor(200, 100);
        $white = imagecolorallocate($im, 255, 255, 255);
        imagefilledrectangle($im, 0, 0, 200, 100, $white);
        ob_start();
        imagejpeg($im, null, 90);
        $bytes = (string) ob_get_clean();
        imagedestroy($im);

        return base64_encode($bytes);
    }

    /** Build a fake PaddleOCR-service response: a flat list of recognised text lines. */
    private function ocrLinesResponse(array $lines): array
    {
        return ['lines' => $lines];
    }

    public function test_ocr_requires_authentication(): void
    {
        $this->postJson('/api/ocr/extract', [
            'image' => 'x',
            'departments' => ['College of Engineering'],
        ])->assertUnauthorized();
    }

    public function test_a_successful_two_department_extraction_returns_both_scores(): void
    {
        $this->actingAsRole('judge');

        Http::fake([
            '127.0.0.1:5001/*' => Http::response($this->ocrLinesResponse([
                ['text' => 'College of Engineering: 87.5', 'confidence' => 0.9],
                ['text' => 'College of Information Technology: 92', 'confidence' => 0.8],
            ]), 200),
        ]);

        $response = $this->postJson('/api/ocr/extract', [
            'image' => $this->imageBase64(),
            'departments' => ['College of Engineering', 'College of Information Technology'],
        ])->assertOk()
            ->assertJsonStructure(['scores', 'image_url', 'notes', 'is_mock']);

        $response->assertJsonPath('is_mock', false);
        $scores = $response->json('scores');

        $this->assertCount(2, $scores);
        $this->assertEqualsCanonicalizing(
            ['College of Engineering', 'College of Information Technology'],
            array_column($scores, 'department')
        );

        $byDept = collect($scores)->keyBy('department');
        $this->assertSame(87.5, (float) $byDept['College of Engineering']['score']);
        $this->assertSame(92.0, (float) $byDept['College of Information Technology']['score']);
        $this->assertSame('', $response->json('notes'));

        Http::assertSent(function ($request) {
            return $request->url() === 'http://127.0.0.1:5001/extract';
        });
    }

    public function test_a_department_with_no_matching_line_is_left_out_not_guessed(): void
    {
        $this->actingAsRole('judge');

        Http::fake([
            '127.0.0.1:5001/*' => Http::response($this->ocrLinesResponse([
                ['text' => 'College of Engineering: 87', 'confidence' => 0.9],
            ]), 200),
        ]);

        $response = $this->postJson('/api/ocr/extract', [
            'image' => $this->imageBase64(),
            'departments' => ['College of Engineering', 'College of Information Technology'],
        ])->assertOk();

        $scores = $response->json('scores');
        $this->assertCount(1, $scores);
        $this->assertSame('College of Engineering', $scores[0]['department']);
        $this->assertStringContainsString('College of Information Technology', $response->json('notes'));
    }

    public function test_a_name_and_score_in_separate_table_cells_on_the_same_row_are_matched(): void
    {
        // The real, actual scoresheet templates print a college's name and
        // its score in separate table cells (same row, different column),
        // not one sentence — this is what OCR actually returns for those,
        // confirmed against a rendering of the real layout.
        $this->actingAsRole('judge');

        Http::fake([
            '127.0.0.1:5001/*' => Http::response($this->ocrLinesResponse([
                ['text' => 'TEAM / DEPARTMENT', 'confidence' => 0.99, 'poly' => [[15, 10], [397, 10], [397, 44], [15, 44]]],
                ['text' => 'OVERALL SCORE', 'confidence' => 0.99, 'poly' => [[498, 11], [796, 11], [796, 43], [498, 43]]],
                ['text' => 'College of Engineering', 'confidence' => 0.95, 'poly' => [[16, 88], [430, 88], [430, 129], [16, 129]]],
                ['text' => '87', 'confidence' => 0.9, 'poly' => [[544, 89], [599, 89], [599, 127], [544, 127]]],
                ['text' => 'College of IT', 'confidence' => 0.93, 'poly' => [[17, 192], [248, 192], [248, 227], [17, 227]]],
                ['text' => '92', 'confidence' => 0.88, 'poly' => [[544, 190], [599, 190], [599, 227], [544, 227]]],
            ]), 200),
        ]);

        $response = $this->postJson('/api/ocr/extract', [
            'image' => $this->imageBase64(),
            'departments' => ['College of Engineering', 'College of IT'],
        ])->assertOk();

        $byDept = collect($response->json('scores'))->keyBy('department');
        $this->assertCount(2, $byDept);
        $this->assertSame(87.0, (float) $byDept['College of Engineering']['score']);
        $this->assertSame(0.9, (float) $byDept['College of Engineering']['confidence']);
        $this->assertSame(92.0, (float) $byDept['College of IT']['score']);
    }

    public function test_a_single_letter_ocr_misread_still_matches_the_department_name(): void
    {
        // Confirmed against a real photo: PaddleOCR read a genuine official
        // score sheet's "College of Informatics and Computing Sciences" as
        // "...Sclences" (c/i swap). A plain substring check would drop this
        // college entirely even though a human reads it correctly at a
        // glance — the match must tolerate a small number of OCR misreads.
        $this->actingAsRole('judge');

        Http::fake([
            '127.0.0.1:5001/*' => Http::response($this->ocrLinesResponse([
                ['text' => 'College of Informatics and Computing Sclences', 'confidence' => 0.99, 'poly' => [[16, 88], [430, 88], [430, 129], [16, 129]]],
                ['text' => '87', 'confidence' => 0.9, 'poly' => [[544, 89], [599, 89], [599, 127], [544, 127]]],
            ]), 200),
        ]);

        $response = $this->postJson('/api/ocr/extract', [
            'image' => $this->imageBase64(),
            'departments' => ['College of Informatics and Computing Sciences'],
        ])->assertOk();

        $scores = $response->json('scores');
        $this->assertCount(1, $scores);
        $this->assertSame('College of Informatics and Computing Sciences', $scores[0]['department']);
        $this->assertSame(87.0, (float) $scores[0]['score']);
    }

    public function test_fuzzy_matching_does_not_confuse_two_different_departments(): void
    {
        // The tolerance that lets "Sclences" match "Sciences" must not be so
        // loose that it also matches a genuinely different department name.
        $this->actingAsRole('judge');

        Http::fake([
            '127.0.0.1:5001/*' => Http::response($this->ocrLinesResponse([
                ['text' => 'College of Informatics and Computing Sclences', 'confidence' => 0.99],
            ]), 200),
        ]);

        $response = $this->postJson('/api/ocr/extract', [
            'image' => $this->imageBase64(),
            'departments' => ['College of Engineering'],
        ])->assertStatus(422);

        $this->assertSame([], $response->json('scores'));
    }

    public function test_a_matched_line_with_no_readable_number_is_left_out(): void
    {
        $this->actingAsRole('judge');

        Http::fake([
            '127.0.0.1:5001/*' => Http::response($this->ocrLinesResponse([
                ['text' => 'College of Engineering', 'confidence' => 0.9],
            ]), 200),
        ]);

        $response = $this->postJson('/api/ocr/extract', [
            'image' => $this->imageBase64(),
            'departments' => ['College of Engineering'],
        ])->assertStatus(422);

        $this->assertSame([], $response->json('scores'));
    }

    public function test_ocr_service_unreachable_degrades_to_422_not_500(): void
    {
        $this->actingAsRole('judge');

        Http::fake([
            '127.0.0.1:5001/*' => fn () => throw new ConnectionException('Connection refused'),
        ]);

        $response = $this->postJson('/api/ocr/extract', [
            'image' => $this->imageBase64(),
            'departments' => ['College of Engineering'],
        ])->assertStatus(422)
            ->assertJsonStructure(['error', 'image_url', 'scores', 'is_mock']);

        $this->assertNotEmpty($response->json('error'));
        $this->assertSame([], $response->json('scores'));
    }

    public function test_ocr_service_error_response_degrades_to_422_not_500(): void
    {
        $this->actingAsRole('judge');

        Http::fake([
            '127.0.0.1:5001/*' => Http::response(['error' => 'OCR processing failed'], 500),
        ]);

        $response = $this->postJson('/api/ocr/extract', [
            'image' => $this->imageBase64(),
            'departments' => ['College of Engineering'],
        ])->assertStatus(422);

        $this->assertNotEmpty($response->json('error'));
        $this->assertSame([], $response->json('scores'));
    }

    public function test_image_is_still_stored_and_url_returned_when_the_service_call_fails(): void
    {
        $this->actingAsRole('judge');

        Http::fake([
            '127.0.0.1:5001/*' => Http::response(['error' => 'boom'], 500),
        ]);

        $response = $this->postJson('/api/ocr/extract', [
            'image' => $this->imageBase64(),
            'departments' => ['College of Engineering'],
        ])->assertStatus(422);

        $this->assertNotNull($response->json('image_url'));
        $this->assertNotEmpty(Storage::disk('public')->files('ocr_captures'));
    }

    public function test_departments_field_is_required(): void
    {
        $this->actingAsRole('judge');

        $this->postJson('/api/ocr/extract', [
            'image' => $this->imageBase64(),
        ])->assertStatus(422)
            ->assertJsonValidationErrors('departments');
    }

    public function test_departments_can_arrive_as_a_json_encoded_string_in_a_multipart_form(): void
    {
        $this->actingAsRole('judge');

        Http::fake([
            '127.0.0.1:5001/*' => Http::response($this->ocrLinesResponse([
                ['text' => 'College of Engineering: 75', 'confidence' => 0.7],
            ]), 200),
        ]);

        $response = $this->post('/api/ocr/extract', [
            'image_file' => UploadedFile::fake()->image('sheet.jpg'),
            'departments' => json_encode(['College of Engineering']),
        ], ['Accept' => 'application/json'])
            ->assertOk();

        $scores = $response->json('scores');
        $this->assertCount(1, $scores);
        $this->assertSame('College of Engineering', $scores[0]['department']);
    }

    public function test_a_non_image_base64_payload_is_not_stored(): void
    {
        $this->actingAsRole('judge');

        $this->postJson('/api/ocr/extract', [
            'image' => 'this-is-not-an-image',
            'departments' => ['College of Engineering'],
        ])->assertStatus(422)
            ->assertJsonPath('image_url', null);

        $this->assertEmpty(Storage::disk('public')->allFiles());
    }

    public function test_a_valid_base64_image_is_persisted_for_the_audit_trail(): void
    {
        $this->actingAsRole('judge');

        Http::fake([
            '127.0.0.1:5001/*' => Http::response($this->ocrLinesResponse([
                ['text' => 'College of Engineering: 92', 'confidence' => 0.9],
            ]), 200),
        ]);

        $url = $this->postJson('/api/ocr/extract', [
            'image' => $this->imageBase64(),
            'departments' => ['College of Engineering'],
        ])->assertOk()
            ->json('image_url');

        $this->assertNotNull($url);
        $this->assertNotEmpty(Storage::disk('public')->files('ocr_captures'));
    }

    public function test_an_uploaded_non_image_file_is_rejected_by_validation(): void
    {
        $this->actingAsRole('judge');

        $this->post('/api/ocr/extract', [
            'image_file' => UploadedFile::fake()->create('notes.pdf', 10, 'application/pdf'),
            'departments' => ['College of Engineering'],
        ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('image_file');
    }

    public function test_no_lines_recognised_returns_422(): void
    {
        $this->actingAsRole('judge');

        Http::fake([
            '127.0.0.1:5001/*' => Http::response($this->ocrLinesResponse([]), 200),
        ]);

        $response = $this->postJson('/api/ocr/extract', [
            'image' => $this->imageBase64(),
            'departments' => ['College of Engineering'],
        ])->assertStatus(422);

        $this->assertSame([], $response->json('scores'));
        $this->assertNotNull($response->json('image_url'));
    }
}
