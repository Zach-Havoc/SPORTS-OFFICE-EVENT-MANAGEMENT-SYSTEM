<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The athlete's own view of their attendance and team — resolved through the
 * `athletes.user_id` link, not an email match, so it still works when the
 * account email and the roster row's email differ.
 */
class AthleteSelfServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_attendance_resolves_by_user_id_even_when_emails_differ(): void
    {
        $coach = $this->users()->state(['role' => 'coach'])->create();
        $athleteUser = $this->users()->state([
            'role' => 'athlete',
            'email' => 'account-email@example.com',
        ])->create();

        // The roster row was entered by the coach under a different (older)
        // email, then later linked to this account by user_id.
        $roster = $this->athletes()->create([
            'user_id' => $athleteUser->id,
            'email' => 'roster-email@example.com',
            'coach_id' => $coach->id,
        ]);

        $session = $this->attendanceSessions()->create(['coach_id' => $coach->id, 'title' => 'Morning Drill']);
        $this->attendance()->create([
            'athlete_id' => $roster->id,
            'session_id' => $session->id,
            'date' => $session->date,
            'status' => 'present',
            'recorded_by' => $coach->id,
        ]);

        $this->loginAs($athleteUser);
        $res = $this->getJson('/api/attendance')->assertOk();

        $res->assertJsonCount(1);
        $this->assertSame('present', $res->json('0.status'));
        $this->assertSame('Morning Drill', $res->json('0.session_title'));
    }

    public function test_an_unlinked_athlete_sees_nothing_belonging_to_someone_else(): void
    {
        $coach = $this->users()->state(['role' => 'coach'])->create();
        $me = $this->users()->state(['role' => 'athlete', 'email' => 'me@example.com'])->create();
        $otherRoster = $this->athletes()->create(['coach_id' => $coach->id, 'email' => 'someone-else@example.com']);

        $this->attendance()->create(['athlete_id' => $otherRoster->id, 'status' => 'present', 'recorded_by' => $coach->id]);

        $this->loginAs($me);
        $this->getJson('/api/attendance')->assertOk()->assertJsonCount(0);
    }

    public function test_my_team_lists_teammates_and_the_coachs_announcements(): void
    {
        $coach = $this->users()->state(['role' => 'coach', 'name' => 'Coach Rivera'])->create();
        $other = $this->users()->state(['role' => 'coach'])->create();

        $me = $this->users()->state(['role' => 'athlete', 'coach_id' => $coach->id])->create();
        $teammate = $this->users()->state(['role' => 'athlete', 'coach_id' => $coach->id, 'name' => 'Teammate'])->create();
        $this->users()->state(['role' => 'athlete', 'coach_id' => $other->id])->create(); // a different team

        $this->announcements()->create(['coach_id' => $coach->id, 'title' => 'Practice moved']);
        $this->announcements()->create(['coach_id' => $other->id, 'title' => 'Not my team']);

        $this->loginAs($me);
        $res = $this->getJson('/api/my-team')->assertOk();

        $res->assertJsonPath('coach.name', 'Coach Rivera')
            ->assertJsonCount(1, 'teammates')
            ->assertJsonPath('teammates.0.name', 'Teammate')
            ->assertJsonCount(1, 'announcements')
            ->assertJsonPath('announcements.0.title', 'Practice moved');
    }

    public function test_my_team_is_empty_when_not_enrolled(): void
    {
        $me = $this->users()->state(['role' => 'athlete'])->create();
        $this->loginAs($me);

        $this->getJson('/api/my-team')->assertOk()->assertJsonPath('coach', null);
    }
}
