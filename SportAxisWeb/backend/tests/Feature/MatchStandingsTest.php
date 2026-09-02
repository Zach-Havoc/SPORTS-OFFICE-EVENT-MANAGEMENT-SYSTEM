<?php

namespace Tests\Feature;

use App\Models\TeamMatch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Head-to-head match records + standings.
 *
 *   - A 2-team scored event auto-produces a `team_matches` row (mobile app path)
 *   - Admins can enter/edit results directly
 *   - GET /api/standings/{sport} aggregates them into a seedable table
 */
class MatchStandingsTest extends TestCase
{
    use RefreshDatabase;

    // ── Auto-derivation from the scoring flow ───────────────────────────

    public function test_scoring_a_two_team_event_creates_a_match_record(): void
    {
        $this->actingAsRole('judge');
        $event = $this->events()->ongoing()->create(['category' => 'Basketball']);

        $this->postJson('/api/scores', [
            'eventId'    => $event->id,
            'department' => 'CICS',
            'scores'     => ['pts' => 1],
            'totalScore' => 78,
        ])->assertCreated();

        // Only one team scored so far → no match yet.
        $this->assertDatabaseCount('team_matches', 0);

        $this->actingAsRole('judge');
        $this->postJson('/api/scores', [
            'eventId'    => $event->id,
            'department' => 'CABEIHM',
            'scores'     => ['pts' => 1],
            'totalScore' => 65,
        ])->assertCreated();

        $match = TeamMatch::where('event_id', $event->id)->first();
        $this->assertNotNull($match);
        $this->assertSame('Basketball', $match->sport);
        $this->assertSame('CICS', $match->winner);            // higher score wins
        $this->assertEqualsWithDelta(78, (float) $match->home_score, 0.01);
        $this->assertEqualsWithDelta(65, (float) $match->away_score, 0.01);
    }

    public function test_multi_team_judged_event_does_not_create_a_match(): void
    {
        $this->actingAsRole('judge');
        $event = $this->events()->ongoing()->create(['category' => 'Cheerdance']);

        foreach (['A' => 90, 'B' => 85, 'C' => 80] as $dept => $score) {
            $this->actingAsRole('judge');
            $this->postJson('/api/scores', [
                'eventId' => $event->id, 'department' => $dept,
                'scores' => ['x' => 1], 'totalScore' => $score,
            ])->assertCreated();
        }

        $this->assertDatabaseCount('team_matches', 0);
    }

    public function test_a_re_score_updates_the_same_match_and_can_flip_the_winner(): void
    {
        $this->actingAsRole('judge');
        $event = $this->events()->ongoing()->create(['category' => 'Basketball']);

        $post = fn (string $dept, float $total) => $this->postJson('/api/scores', [
            'eventId' => $event->id, 'department' => $dept, 'scores' => ['x' => 1], 'totalScore' => $total,
        ]);

        $post('CICS', 70)->assertCreated();
        $this->actingAsRole('judge');
        $post('CABEIHM', 80)->assertCreated(); // CABEIHM leads

        $this->assertSame('CABEIHM', TeamMatch::where('event_id', $event->id)->first()->winner);

        // A correction comes in for CICS.
        $this->actingAsRole('judge');
        $post('CICS', 95)->assertCreated();

        $this->assertSame(1, TeamMatch::where('event_id', $event->id)->count());
        $this->assertSame('CICS', TeamMatch::where('event_id', $event->id)->first()->winner);
    }

    // ── Direct entry (admin) ───────────────────────────────────────────

    public function test_only_admins_can_enter_a_match_result(): void
    {
        $payload = ['sport' => 'Volleyball', 'homeTeam' => 'A', 'awayTeam' => 'B', 'homeScore' => 25, 'awayScore' => 20];

        $this->postJson('/api/matches', $payload)->assertUnauthorized();

        $this->actingAsRole('coach');
        $this->postJson('/api/matches', $payload)->assertForbidden();

        $this->actingAsRole('admin');
        $this->postJson('/api/matches', $payload)
            ->assertCreated()
            ->assertJsonFragment(['winner' => 'A', 'status' => 'completed']);
    }

    public function test_home_and_away_team_must_differ(): void
    {
        $this->actingAsRole('admin');

        $this->postJson('/api/matches', ['sport' => 'X', 'homeTeam' => 'A', 'awayTeam' => 'A'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('awayTeam');
    }

    public function test_admin_can_update_scores_and_the_winner_is_recomputed(): void
    {
        $this->actingAsRole('admin');
        $match = $this->teamMatches()->result('Football', 'A', 1, 'B', 0)->create();
        $this->assertSame('A', $match->winner);

        $this->putJson("/api/matches/{$match->id}", ['homeScore' => 1, 'awayScore' => 3])
            ->assertOk()
            ->assertJsonFragment(['winner' => 'B']);
    }

    public function test_equal_scores_are_recorded_as_a_draw(): void
    {
        $this->actingAsRole('admin');

        $this->postJson('/api/matches', ['sport' => 'Football', 'homeTeam' => 'A', 'awayTeam' => 'B', 'homeScore' => 2, 'awayScore' => 2])
            ->assertCreated()
            ->assertJsonFragment(['is_draw' => true, 'winner' => null]);
    }

    // ── Standings ──────────────────────────────────────────────────────

    public function test_standings_are_public_and_ordered_wins_then_differential(): void
    {
        // Round robin among A, B, C for Basketball.
        $this->teamMatches()->result('Basketball', 'A', 80, 'B', 60)->create(); // A beats B by 20
        $this->teamMatches()->result('Basketball', 'A', 70, 'C', 68)->create(); // A beats C by 2
        $this->teamMatches()->result('Basketball', 'B', 75, 'C', 50)->create(); // B beats C by 25
        // A different sport must not bleed in.
        $this->teamMatches()->result('Volleyball', 'C', 25, 'A', 10)->create();

        $rows = $this->getJson('/api/standings/Basketball')->assertOk()->json();

        $this->assertCount(3, $rows);

        // A: 2-0. B: 1-1 (+5 diff). C: 0-2.
        $this->assertSame('A', $rows[0]['department']);
        $this->assertSame(2, $rows[0]['wins']);
        $this->assertSame(1, $rows[0]['seed']);

        $this->assertSame('B', $rows[1]['department']);
        $this->assertSame(1, $rows[1]['wins']);

        $this->assertSame('C', $rows[2]['department']);
        $this->assertSame(2, $rows[2]['losses']);
        $this->assertSame(3, $rows[2]['seed']);
    }

    public function test_head_to_head_breaks_a_two_way_tie(): void
    {
        // A and B finish level on wins (1-1), differential (0) and points scored
        // (25). B beat A head-to-head, so B seeds ahead of A. (X ends up on 30
        // points-for, so it's not part of the tie.)
        $this->teamMatches()->result('Chess', 'A', 20, 'X', 10)->create(); // A beat X
        $this->teamMatches()->result('Chess', 'X', 20, 'B', 10)->create(); // X beat B
        $this->teamMatches()->result('Chess', 'B', 15, 'A', 5)->create();  // B beat A

        $rows = collect($this->getJson('/api/standings/Chess')->assertOk()->json());

        $this->assertLessThan(
            $rows->firstWhere('department', 'A')['seed'],
            $rows->firstWhere('department', 'B')['seed'],
        );
    }
}
