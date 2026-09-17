<?php

namespace Tests\Feature;

use App\Models\Athlete;
use App\Models\Requirement;
use App\Models\RequirementType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * The eligibility checklist: a catalog of required documents, and whether an
 * athlete is "cleared" (an approved submission against every active,
 * required, sport-matching entry).
 */
class RequirementEligibilityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    /** @return array{0: User, 1: Athlete} */
    private function athleteWithSport(string $sport): array
    {
        $user = $this->users()->state(['role' => 'athlete', 'sport' => $sport])->create();
        $athlete = $this->athletes()->create(['user_id' => $user->id, 'sport' => $sport]);

        return [$user, $athlete];
    }

    public function test_the_four_default_checklist_entries_are_seeded(): void
    {
        $this->assertSame(4, RequirementType::count());
        $this->assertTrue(RequirementType::where('name', 'Medical Clearance')->exists());
    }

    public function test_only_admin_or_coach_can_manage_the_checklist(): void
    {
        [$athleteUser] = $this->athleteWithSport('Basketball');
        $this->loginAs($athleteUser);
        $this->postJson('/api/requirement-types', ['name' => 'Fitness Test'])->assertForbidden();

        $this->actingAsRole('coach');
        $this->postJson('/api/requirement-types', ['name' => 'Fitness Test', 'sport' => 'Basketball'])
            ->assertCreated()
            ->assertJsonPath('name', 'Fitness Test')
            ->assertJsonPath('required', true);
    }

    public function test_a_duplicate_name_and_sport_is_rejected(): void
    {
        $this->actingAsRole('admin');
        $this->postJson('/api/requirement-types', ['name' => 'Medical Clearance'])
            ->assertJsonValidationErrors('name');
    }

    public function test_an_athlete_with_no_approvals_is_not_cleared(): void
    {
        [$user] = $this->athleteWithSport('Basketball');
        $this->loginAs($user);

        $res = $this->getJson('/api/requirements/my/clearance')->assertOk();
        $res->assertJsonPath('cleared', false)
            ->assertJsonPath('requiredCount', 4)
            ->assertJsonPath('approvedCount', 0)
            ->assertJsonCount(4, 'missing');
    }

    public function test_approving_every_required_type_clears_the_athlete(): void
    {
        [$user, $athlete] = $this->athleteWithSport('Basketball');

        foreach (RequirementType::all() as $type) {
            Requirement::create([
                'id' => (string) Str::uuid(),
                'athlete_id' => $athlete->id,
                'athlete_name' => $user->name,
                'type' => 'waiver',
                'requirement_type_id' => $type->id,
                'name' => $type->name,
                'status' => 'approved',
                'submitted_at' => now(),
            ]);
        }

        $this->loginAs($user);
        $this->getJson('/api/requirements/my/clearance')
            ->assertOk()
            ->assertJsonPath('cleared', true)
            ->assertJsonPath('approvedCount', 4)
            ->assertJsonCount(0, 'missing');
    }

    public function test_a_sport_specific_type_only_counts_for_that_sport(): void
    {
        $this->actingAsRole('admin');
        $this->postJson('/api/requirement-types', ['name' => 'Weigh-In Sheet', 'sport' => 'Wrestling'])
            ->assertCreated();

        [$user] = $this->athleteWithSport('Basketball');
        $this->loginAs($user);

        // A basketball player never sees the wrestling-only entry.
        $this->getJson('/api/requirements/my/clearance')->assertJsonPath('requiredCount', 4);
    }

    public function test_resubmitting_a_rejected_document_links_the_two(): void
    {
        [$user, $athlete] = $this->athleteWithSport('Basketball');
        $type = RequirementType::first();

        $rejected = Requirement::create([
            'id' => (string) Str::uuid(),
            'athlete_id' => $athlete->id,
            'athlete_name' => $user->name,
            'type' => 'waiver',
            'requirement_type_id' => $type->id,
            'name' => $type->name,
            'status' => 'rejected',
            'submitted_at' => now(),
        ]);

        $this->loginAs($user);
        $res = $this->post('/api/requirements', [
            'type' => 'waiver',
            'requirementTypeId' => $type->id,
            'supersedesId' => $rejected->id,
            'name' => $type->name,
            'file' => UploadedFile::fake()->create('waiver.pdf', 100, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $this->assertSame($rejected->id, $res->json('supersedes_id'));
    }

    public function test_resubmitting_cannot_target_someone_elses_requirement(): void
    {
        [, $athleteA] = $this->athleteWithSport('Basketball');
        [$userB] = $this->athleteWithSport('Volleyball');
        $type = RequirementType::first();

        $rejected = Requirement::create([
            'id' => (string) Str::uuid(),
            'athlete_id' => $athleteA->id,
            'athlete_name' => 'Athlete A',
            'type' => 'waiver',
            'requirement_type_id' => $type->id,
            'name' => $type->name,
            'status' => 'rejected',
            'submitted_at' => now(),
        ]);

        $this->loginAs($userB);
        $res = $this->post('/api/requirements', [
            'type' => 'waiver',
            'supersedesId' => $rejected->id,
            'name' => 'Signed Waiver',
            'file' => UploadedFile::fake()->create('waiver.pdf', 100, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $this->assertNull($res->json('supersedes_id'));
    }
}
