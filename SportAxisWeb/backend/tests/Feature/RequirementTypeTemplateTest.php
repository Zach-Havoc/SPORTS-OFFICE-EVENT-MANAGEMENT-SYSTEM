<?php

namespace Tests\Feature;

use App\Models\RequirementType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * A coach/admin can attach a blank template (e.g. a Parental Consent form)
 * to a checklist entry, for the athlete to download, sign, and re-upload.
 */
class RequirementTypeTemplateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    private function makeType(): RequirementType
    {
        return RequirementType::create([
            'id' => Str::uuid(),
            'name' => 'Parental Consent',
            'required' => true,
            'active' => true,
        ]);
    }

    public function test_athlete_cannot_upload_a_template(): void
    {
        $type = $this->makeType();
        $this->actingAsRole('athlete');

        $this->post("/api/requirement-types/{$type->id}/template", [
            'template' => UploadedFile::fake()->create('consent.pdf', 100, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertForbidden();
    }

    public function test_coach_can_upload_and_replace_a_template(): void
    {
        $type = $this->makeType();
        $this->actingAsRole('coach');

        $this->post("/api/requirement-types/{$type->id}/template", [
            'template' => UploadedFile::fake()->create('consent.pdf', 100, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertOk();

        $first = $type->fresh()->template_file_url;
        $this->assertNotNull($first);

        // Uploading again replaces it and removes the old file.
        $this->post("/api/requirement-types/{$type->id}/template", [
            'template' => UploadedFile::fake()->create('consent-v2.pdf', 100, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertOk();

        $second = $type->fresh()->template_file_url;
        $this->assertNotSame($first, $second);
    }

    public function test_executable_template_uploads_are_rejected(): void
    {
        $type = $this->makeType();
        $this->actingAsRole('coach');

        $this->post("/api/requirement-types/{$type->id}/template", [
            'template' => UploadedFile::fake()->create('shell.php', 10),
        ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('template');
    }

    public function test_coach_can_delete_a_template(): void
    {
        $type = $this->makeType();
        $type->update(['template_file_url' => '/storage/requirement_type_templates/x.pdf']);
        $this->actingAsRole('coach');

        $this->deleteJson("/api/requirement-types/{$type->id}/template")->assertOk();

        $this->assertNull($type->fresh()->template_file_url);
    }
}
