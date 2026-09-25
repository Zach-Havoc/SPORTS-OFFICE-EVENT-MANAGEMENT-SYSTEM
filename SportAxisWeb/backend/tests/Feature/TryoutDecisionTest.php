<?php

namespace Tests\Feature;

use App\Models\Athlete;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/** PUT /api/tryouts/{id}/status — a coach decides on their applicants. */
class TryoutDecisionTest extends TestCase
{
    use RefreshDatabase;

    public function test_accepting_puts_the_applicant_on_the_coachs_roster(): void
    {
        $coach = $this->users()->coach()->create();
        $app = $this->tryouts()->create([
            'coach_id' => $coach->id, 'first_name' => 'Ana', 'last_name' => 'Reyes',
            'student_id' => '24-00001', 'sport' => 'Volleyball',
        ]);

        $this->loginAs($coach);
        $res = $this->putJson("/api/tryouts/{$app->id}/status", ['status' => 'accepted', 'note' => 'Strong serve'])
            ->assertOk()
            ->assertJsonPath('application.status', 'accepted')
            ->assertJsonPath('application.review_note', 'Strong serve');

        $athlete = Athlete::find($res->json('athleteId'));
        $this->assertNotNull($athlete);
        $this->assertSame($coach->id, $athlete->coach_id);
        $this->assertSame('24-00001', $athlete->student_id);
        $this->assertSame('Volleyball', $athlete->sport);
        $this->assertSame($coach->id, $app->fresh()->reviewed_by);
        $this->assertNotNull($app->fresh()->reviewed_at);
    }

    public function test_accepting_a_student_who_already_has_an_account_links_to_it(): void
    {
        $coach = $this->users()->coach()->create();
        $account = $this->users()->create(['role' => 'athlete', 'sr_code' => '24-00001']);
        $app = $this->tryouts()->create(['coach_id' => $coach->id, 'student_id' => '24-00001']);

        $this->loginAs($coach);
        $id = $this->putJson("/api/tryouts/{$app->id}/status", ['status' => 'accepted'])->assertOk()->json('athleteId');

        $athlete = Athlete::find($id);
        $this->assertSame($account->id, $athlete->user_id);
        $this->assertNull($athlete->student_id);
    }

    public function test_accepting_someone_already_on_the_roster_does_not_duplicate_them(): void
    {
        $coach = $this->users()->coach()->create();
        $existing = $this->athletes()->create(['coach_id' => $coach->id, 'student_id' => '24-00001']);
        $app = $this->tryouts()->create(['coach_id' => $coach->id, 'student_id' => '24-00001']);

        $this->loginAs($coach);
        $this->putJson("/api/tryouts/{$app->id}/status", ['status' => 'accepted'])
            ->assertOk()
            ->assertJsonPath('athleteId', $existing->id);

        $this->assertSame(1, Athlete::where('student_id', '24-00001')->count());
    }

    public function test_rejecting_closes_it_without_touching_the_roster(): void
    {
        Mail::fake();
        $coach = $this->users()->coach()->create();
        $app = $this->tryouts()->create(['coach_id' => $coach->id]);

        $this->loginAs($coach);
        $this->putJson("/api/tryouts/{$app->id}/status", ['status' => 'rejected'])
            ->assertOk()
            ->assertJsonPath('application.status', 'rejected')
            ->assertJsonPath('athleteId', null);

        $this->assertDatabaseCount('athletes', 0);
    }

    public function test_a_decision_is_final(): void
    {
        $coach = $this->users()->coach()->create();
        $app = $this->tryouts()->create(['coach_id' => $coach->id, 'status' => 'rejected']);

        $this->loginAs($coach);
        $this->putJson("/api/tryouts/{$app->id}/status", ['status' => 'accepted'])
            ->assertStatus(422)
            ->assertJsonFragment(['error' => 'This application was already rejected.']);
    }

    public function test_a_coach_cannot_decide_another_coachs_applicant(): void
    {
        $owner = $this->users()->coach()->create();
        $app = $this->tryouts()->create(['coach_id' => $owner->id]);

        $this->actingAsRole('coach');
        $this->putJson("/api/tryouts/{$app->id}/status", ['status' => 'accepted'])->assertForbidden();
        $this->assertSame('pending', $app->fresh()->status);
    }

    public function test_the_office_can_decide_and_the_student_joins_the_announcing_coach(): void
    {
        $coach = $this->users()->coach()->create();
        $app = $this->tryouts()->create(['coach_id' => $coach->id]);

        $this->actingAsRole('admin');
        $id = $this->putJson("/api/tryouts/{$app->id}/status", ['status' => 'accepted'])->assertOk()->json('athleteId');

        $this->assertSame($coach->id, Athlete::find($id)->coach_id);
    }

    public function test_athletes_and_judges_cannot_decide(): void
    {
        $app = $this->tryouts()->create();

        foreach (['athlete', 'judge'] as $role) {
            $this->actingAsRole($role);
            $this->putJson("/api/tryouts/{$app->id}/status", ['status' => 'accepted'])->assertForbidden();
        }
    }

    public function test_the_status_must_be_a_decision(): void
    {
        $coach = $this->users()->coach()->create();
        $app = $this->tryouts()->create(['coach_id' => $coach->id]);

        $this->loginAs($coach);
        $this->putJson("/api/tryouts/{$app->id}/status", ['status' => 'maybe'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }
}
