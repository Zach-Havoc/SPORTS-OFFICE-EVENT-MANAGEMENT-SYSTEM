<?php

namespace Tests\Feature;

use App\Models\Score;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Scoring + ranking:
 *   POST /api/scores            (judge or admin only; identity from token)
 *   GET  /api/scores/{eventId}  (public)
 *   GET  /api/rankings/{eventId}(public)
 *   GET  /api/leaderboard       (public)
 *   GET  /api/judge/{id}/status (public)
 *
 * Security focus: only judges/admins may submit, and the judge_id is always
 * taken from the authenticated token, never from the request body.
 */
class ScoreRankingTest extends TestCase
{
    use RefreshDatabase;

    private function scorePayload(string $eventId, array $overrides = []): array
    {
        return array_merge([
            'eventId'    => $eventId,
            'department' => 'College of Engineering',
            'scores'     => ['Technical' => 8, 'Teamwork' => 9],
            'totalScore' => 85,
        ], $overrides);
    }

    public function test_submitting_a_score_requires_authentication(): void
    {
        $event = $this->events()->ongoing()->create();

        $this->postJson('/api/scores', $this->scorePayload($event->id))->assertUnauthorized();
    }

    public function test_athletes_and_coaches_cannot_submit_scores(): void
    {
        $event = $this->events()->ongoing()->create();

        $this->actingAsRole('athlete');
        $this->postJson('/api/scores', $this->scorePayload($event->id))->assertForbidden();

        $this->actingAsRole('coach');
        $this->postJson('/api/scores', $this->scorePayload($event->id))->assertForbidden();
    }

    public function test_a_judge_can_submit_a_score(): void
    {
        $judge = $this->actingAsRole('judge', ['name' => 'Judge Judy']);
        $event = $this->events()->ongoing()->create();

        $this->postJson('/api/scores', $this->scorePayload($event->id))
            ->assertCreated()
            ->assertJsonFragment(['message' => 'Score submitted successfully.']);

        $this->assertDatabaseHas('scores', [
            'event_id'   => $event->id,
            'department' => 'College of Engineering',
            'judge_id'   => $judge->id,     // taken from the token
            'judge_name' => 'Judge Judy',   // defaulted from the user
        ]);
    }

    public function test_judge_id_in_the_body_is_ignored_no_spoofing(): void
    {
        $judge = $this->actingAsRole('judge');
        $event = $this->events()->ongoing()->create();

        $this->postJson('/api/scores', $this->scorePayload($event->id, [
            'judgeId'   => 'some-other-judge-id',
            'judgeName' => 'Fake Name',
        ]))->assertCreated();

        // Stored under the authenticated judge, not the spoofed id.
        $this->assertSame($judge->id, Score::first()->judge_id);
        $this->assertDatabaseMissing('scores', ['judge_id' => 'some-other-judge-id']);
    }

    public function test_admin_may_also_submit_scores(): void
    {
        $this->actingAsRole('admin');
        $event = $this->events()->ongoing()->create();

        $this->postJson('/api/scores', $this->scorePayload($event->id))->assertCreated();
    }

    public function test_score_submission_validates_the_event_exists(): void
    {
        $this->actingAsRole('judge');

        $this->postJson('/api/scores', $this->scorePayload('no-such-event'))
            ->assertStatus(422)
            ->assertJsonValidationErrors('eventId');

        $this->postJson('/api/scores', ['department' => 'X', 'scores' => [], 'totalScore' => 1])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['eventId', 'scores']);
    }

    public function test_resubmitting_updates_the_same_row(): void
    {
        $this->actingAsRole('judge');
        $event = $this->events()->ongoing()->create();

        $this->postJson('/api/scores', $this->scorePayload($event->id, ['totalScore' => 70]))->assertCreated();
        $this->postJson('/api/scores', $this->scorePayload($event->id, ['totalScore' => 95]))->assertCreated();

        $this->assertSame(1, Score::where('event_id', $event->id)->count());
        $this->assertEquals(95, Score::first()->total_score);
    }

    public function test_submitting_a_score_recalculates_rankings_highest_average_first(): void
    {
        $this->actingAsRole('judge');
        $event = $this->events()->ongoing()->create();

        $this->postJson('/api/scores', $this->scorePayload($event->id, [
            'department' => 'Team A', 'totalScore' => 90,
        ]))->assertCreated();

        // A different judge scores Team B lower.
        $this->actingAsRole('judge');
        $this->postJson('/api/scores', $this->scorePayload($event->id, [
            'department' => 'Team B', 'totalScore' => 60,
        ]))->assertCreated();

        $rankings = $this->getJson("/api/rankings/{$event->id}")->assertOk()->json();

        $this->assertSame('Team A', $rankings[0]['department']);
        $this->assertSame(1, $rankings[0]['rank']);
        $this->assertSame('Team B', $rankings[1]['department']);
        $this->assertSame(2, $rankings[1]['rank']);
    }

    public function test_public_can_read_scores_and_leaderboard(): void
    {
        $event = $this->events()->create();
        $this->scores()->create(['event_id' => $event->id, 'department' => 'Team A', 'total_score' => 88]);

        $this->getJson("/api/scores/{$event->id}")->assertOk()->assertJsonFragment(['department' => 'Team A']);
        $this->getJson('/api/leaderboard')->assertOk();
    }

    public function test_judge_status_endpoint_reports_submission_state(): void
    {
        $judge = $this->users()->judge()->create();
        $event = $this->events()->create();

        $this->getJson("/api/judge/{$judge->id}/status?eventId={$event->id}")
            ->assertOk()
            ->assertJsonFragment(['submitted' => false]);

        $this->scores()->create([
            'event_id' => $event->id, 'judge_id' => $judge->id, 'department' => 'Team A',
        ]);

        $this->getJson("/api/judge/{$judge->id}/status?eventId={$event->id}")
            ->assertOk()
            ->assertJsonFragment(['submitted' => true]);
    }

    public function test_judge_status_requires_a_real_event_id(): void
    {
        $judge = $this->users()->judge()->create();

        $this->getJson("/api/judge/{$judge->id}/status?eventId=nope")
            ->assertStatus(422)
            ->assertJsonValidationErrors('eventId');
    }
}
