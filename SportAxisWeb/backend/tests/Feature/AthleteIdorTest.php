<?php

namespace Tests\Feature;

use App\Models\Athlete;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Athlete roster endpoints (coach only):
 *   GET/POST         /api/athletes
 *   GET/PUT/DELETE   /api/athletes/{id}
 *   DELETE           /api/athletes/{id}/remove
 *
 * Security focus (IDOR): a coach must only be able to read or mutate athletes
 * on their OWN roster. Another coach's athlete must look like it does not exist.
 */
class AthleteIdorTest extends TestCase
{
    use RefreshDatabase;

    public function test_athlete_endpoints_require_a_coach(): void
    {
        $this->getJson('/api/athletes')->assertUnauthorized();

        $this->actingAsRole('athlete');
        $this->getJson('/api/athletes')->assertForbidden();

        $this->actingAsRole('admin'); // athlete routes are coach-scoped
        $this->getJson('/api/athletes')->assertForbidden();
    }

    public function test_index_only_returns_the_coachs_own_athletes(): void
    {
        $coachA = $this->users()->coach()->create();
        $coachB = $this->users()->coach()->create();

        $this->athletes()->create(['coach_id' => $coachA->id, 'first_name' => 'Mine']);
        $this->athletes()->create(['coach_id' => $coachB->id, 'first_name' => 'Theirs']);

        $this->loginAs($coachA);
        $this->getJson('/api/athletes')
            ->assertOk()
            ->assertJsonFragment(['first_name' => 'Mine'])
            ->assertJsonMissing(['first_name' => 'Theirs']);
    }

    public function test_coach_can_create_an_athlete_on_their_own_roster(): void
    {
        $coach = $this->actingAsRole('coach');

        $this->postJson('/api/athletes', [
            'studentId' => '24-00001',
            'firstName' => 'Sam',
            'lastName'  => 'Cruz',
            'email'     => 'sam@example.com',
        ])->assertCreated();

        $this->assertDatabaseHas('athletes', ['student_id' => '24-00001', 'coach_id' => $coach->id]);
    }

    public function test_student_id_must_be_unique(): void
    {
        $this->actingAsRole('coach');
        $this->athletes()->create(['student_id' => '24-00001']);

        $this->postJson('/api/athletes', [
            'studentId' => '24-00001', 'firstName' => 'A', 'lastName' => 'B', 'email' => 'a@b.com',
        ])->assertStatus(422)->assertJsonValidationErrors('studentId');
    }

    public function test_a_coach_cannot_VIEW_another_coachs_athlete(): void
    {
        $coachA  = $this->users()->coach()->create();
        $athlete = $this->athletes()->create(['coach_id' => $coachA->id]);

        $this->actingAsRole('coach'); // coach B
        $this->getJson("/api/athletes/{$athlete->id}")->assertNotFound();
    }

    public function test_a_coach_CAN_view_their_own_athlete(): void
    {
        $coach   = $this->actingAsRole('coach');
        $athlete = $this->athletes()->create(['coach_id' => $coach->id]);

        $this->getJson("/api/athletes/{$athlete->id}")
            ->assertOk()
            ->assertJsonFragment(['id' => $athlete->id]);
    }

    public function test_a_coach_cannot_UPDATE_another_coachs_athlete(): void
    {
        $coachA  = $this->users()->coach()->create();
        $athlete = $this->athletes()->create(['coach_id' => $coachA->id, 'first_name' => 'Original']);

        $this->actingAsRole('coach'); // coach B
        $this->putJson("/api/athletes/{$athlete->id}", ['firstName' => 'Hacked'])->assertNotFound();

        $this->assertSame('Original', $athlete->fresh()->first_name);
    }

    public function test_a_coach_cannot_DELETE_another_coachs_athlete(): void
    {
        $coachA  = $this->users()->coach()->create();
        $athlete = $this->athletes()->create(['coach_id' => $coachA->id]);

        $this->actingAsRole('coach'); // coach B
        $this->deleteJson("/api/athletes/{$athlete->id}")->assertNotFound();

        $this->assertDatabaseHas('athletes', ['id' => $athlete->id]);
    }

    public function test_a_coach_cannot_REMOVE_another_coachs_athlete_from_roster(): void
    {
        $coachA  = $this->users()->coach()->create();
        $athlete = $this->athletes()->create(['coach_id' => $coachA->id]);

        $this->actingAsRole('coach'); // coach B
        $this->deleteJson("/api/athletes/{$athlete->id}/remove")->assertNotFound();

        $this->assertSame($coachA->id, $athlete->fresh()->coach_id);
    }

    public function test_a_coach_can_update_and_remove_their_own_athlete(): void
    {
        $coach   = $this->actingAsRole('coach');
        $athlete = $this->athletes()->create(['coach_id' => $coach->id]);

        $this->putJson("/api/athletes/{$athlete->id}", ['firstName' => 'Updated'])->assertOk();
        $this->assertSame('Updated', $athlete->fresh()->first_name);

        $this->deleteJson("/api/athletes/{$athlete->id}/remove")->assertOk();
        $this->assertNull($athlete->fresh()->coach_id);
    }

    public function test_update_rejects_an_invalid_email(): void
    {
        $coach   = $this->actingAsRole('coach');
        $athlete = $this->athletes()->create(['coach_id' => $coach->id]);

        $this->putJson("/api/athletes/{$athlete->id}", ['email' => 'not-an-email'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }
}
