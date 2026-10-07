<?php

namespace Tests\Feature;

use App\Models\CmoSubmissionAthlete;
use App\Models\RequirementType;
use App\Notifications\CmoReviewed;
use App\Notifications\CmoSubmitted;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * CMO documents, coach to office: the coach forwards athletes whose required
 * documents are all approved; the office accepts each, or returns them with
 * a note, after which the coach can forward them again.
 */
class CmoSubmissionTest extends TestCase
{
    use RefreshDatabase;

    private RequirementType $enrollment;

    protected function setUp(): void
    {
        parent::setUp();
        $this->enrollment = RequirementType::create(['id' => (string) Str::uuid(), 'name' => 'Certificate of Enrollment', 'required' => true, 'active' => true]);
    }

    /** A coach with two athletes: Ana cleared, Ben with nothing approved yet. */
    private function team(): array
    {
        $coach = $this->users()->coach()->create(['department' => 'CICS', 'active' => true]);
        $ana = $this->athletes()->create(['coach_id' => $coach->id, 'first_name' => 'Ana', 'last_name' => 'Reyes', 'department' => 'CICS', 'sport' => 'Volleyball']);
        $ben = $this->athletes()->create(['coach_id' => $coach->id, 'first_name' => 'Ben', 'last_name' => 'Cruz', 'department' => 'CICS', 'sport' => 'Volleyball']);
        // Ana has an approved document for every required entry (the database
        // already carries the standard checklist, plus the one made above).
        foreach (RequirementType::where('required', true)->where('active', true)->get() as $type) {
            $this->requirements()->create(['athlete_id' => $ana->id, 'athlete_name' => 'Ana Reyes', 'requirement_type_id' => $type->id,
                'name' => $type->name, 'status' => 'approved', 'submitted_at' => now()]);
        }
        $this->requirements()->create(['athlete_id' => $ben->id, 'athlete_name' => 'Ben Cruz', 'requirement_type_id' => $this->enrollment->id,
            'name' => 'Certificate of Enrollment', 'status' => 'pending', 'submitted_at' => now()]);

        return [$coach, $ana, $ben];
    }

    public function test_the_coach_sees_who_is_cleared_to_forward(): void
    {
        [$coach, $ana, $ben] = $this->team();
        $this->actingAs($coach);

        $roster = collect($this->getJson('/api/cmo/roster')->assertOk()->json())->keyBy('id');
        $this->assertTrue($roster[$ana->id]['cleared']);
        $this->assertFalse($roster[$ben->id]['cleared']);
        $this->assertContains('Certificate of Enrollment', $roster[$ben->id]['missing']);
        $this->assertNull($roster[$ana->id]['office']);
    }

    public function test_only_cleared_athletes_on_the_roster_can_be_forwarded_once(): void
    {
        Notification::fake();
        [$coach, $ana, $ben] = $this->team();
        $stranger = $this->athletes()->create(['department' => 'CICS']);
        $admin = $this->users()->state(['role' => 'admin', 'active' => true])->create();
        $this->actingAs($coach);

        $this->postJson('/api/cmo/submissions', ['athleteIds' => [$ben->id]])->assertStatus(422);
        $this->postJson('/api/cmo/submissions', ['athleteIds' => [$stranger->id]])->assertStatus(422);

        $this->postJson('/api/cmo/submissions', ['athleteIds' => [$ana->id], 'note' => 'Team list attached.'])
            ->assertCreated()->assertJsonPath('count', 1);
        Notification::assertSentTo($admin, CmoSubmitted::class);

        // Already with the office.
        $this->postJson('/api/cmo/submissions', ['athleteIds' => [$ana->id]])->assertStatus(422);
    }

    public function test_the_office_sees_forwarded_athletes_with_college_and_sport(): void
    {
        [$coach, $ana] = $this->team();
        $this->actingAs($coach);
        $this->postJson('/api/cmo/submissions', ['athleteIds' => [$ana->id]])->assertCreated();

        $this->actingAsRole('admin');
        $this->getJson('/api/cmo/overview')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.athleteName', 'Ana Reyes')
            ->assertJsonPath('0.department', 'CICS')
            ->assertJsonPath('0.sport', 'Volleyball')
            ->assertJsonPath('0.status', 'submitted')
            ->assertJsonPath('0.coachName', $coach->name);

        $this->getJson("/api/cmo/athletes/{$ana->id}/documents")
            ->assertOk()->assertJsonFragment(['type' => 'Certificate of Enrollment', 'status' => 'approved']);
    }

    public function test_the_office_accepts_or_returns_and_a_returned_athlete_can_be_forwarded_again(): void
    {
        Notification::fake();
        [$coach, $ana] = $this->team();
        $this->actingAs($coach);
        $this->postJson('/api/cmo/submissions', ['athleteIds' => [$ana->id]])->assertCreated();
        $entry = CmoSubmissionAthlete::first();

        $this->actingAsRole('admin');
        // A return needs a note.
        $this->postJson('/api/cmo/review', ['entryIds' => [$entry->id], 'status' => 'returned'])->assertJsonValidationErrors(['note']);
        $this->postJson('/api/cmo/review', ['entryIds' => [$entry->id], 'status' => 'returned', 'note' => 'The certificate is blurry.'])
            ->assertOk()->assertJsonPath('updated', 1);
        Notification::assertSentTo($coach, CmoReviewed::class, fn ($n) => $n->status === 'returned' && $n->note === 'The certificate is blurry.');

        // The coach sees why, and forwards Ana again.
        $this->actingAs($coach);
        $this->getJson('/api/cmo/roster')->assertJsonPath('0.office.status', 'returned')->assertJsonPath('0.office.officeNote', 'The certificate is blurry.');
        $this->postJson('/api/cmo/submissions', ['athleteIds' => [$ana->id]])->assertCreated();

        $this->actingAsRole('admin');
        $latest = CmoSubmissionAthlete::orderByDesc('id')->first();
        $this->postJson('/api/cmo/review', ['entryIds' => [$latest->id], 'status' => 'accepted'])->assertOk();
        $this->getJson('/api/cmo/overview')->assertJsonCount(1)->assertJsonPath('0.status', 'accepted');
    }

    public function test_coaches_cannot_review_and_admins_cannot_forward(): void
    {
        [$coach, $ana] = $this->team();
        $this->actingAs($coach);
        $this->postJson('/api/cmo/review', ['entryIds' => [1], 'status' => 'accepted'])->assertForbidden();
        $this->getJson('/api/cmo/overview')->assertForbidden();

        $this->actingAsRole('admin');
        $this->postJson('/api/cmo/submissions', ['athleteIds' => [$ana->id]])->assertForbidden();
    }
}
