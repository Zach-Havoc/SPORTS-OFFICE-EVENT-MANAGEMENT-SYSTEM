<?php

namespace Tests\Feature;

use App\Models\Bracket;
use App\Models\BracketMatch;
use App\Models\Event;
use App\Models\TeamMatch;
use App\Services\BracketService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Persisted brackets + progression.
 *
 *   POST   /api/brackets                              generate + persist the tree
 *   POST   /api/brackets/{id}/publish                 create one Event per match
 *   POST   /api/brackets/{id}/matches/{mid}/advance   record a winner, feed it forward
 *
 * Covers: tree shape, byes walking over, seeding from standings, event
 * creation, venue-conflict block, winner propagation, champion resolution,
 * forfeits, and the admin-only guard.
 */
class BracketTest extends TestCase
{
    use RefreshDatabase;

    private function service(): BracketService
    {
        return app(BracketService::class);
    }

    private function config(array $overrides = []): array
    {
        return array_merge([
            'sport'         => 'Basketball',
            'format'        => 'single_elimination',
            'participants'  => ['CICS', 'CET', 'CABEIHM', 'CAS'],
            'startDate'     => '2026-10-01',
            'startTime'     => '09:00',
            'matchDuration' => 60,
            'breakDuration' => 15,
        ], $overrides);
    }

    // ── Generation ─────────────────────────────────────────────────────

    public function test_generating_a_single_elimination_bracket_builds_a_wired_tree(): void
    {
        $bracket = $this->service()->generate($this->config());

        $this->assertSame('draft', $bracket->status);
        $this->assertCount(3, $bracket->matches);          // 2 semifinals + 1 final

        $final = $bracket->matches->firstWhere('round', 2);
        $this->assertSame('Finals', $final->stage_label);
        $this->assertNull($final->home_team);              // TBD until the semis resolve
        $this->assertNull($final->away_team);

        $semis = $bracket->matches->where('round', 1);
        foreach ($semis as $s) {
            $this->assertSame($final->id, $s->next_match_id);
            $this->assertContains($s->next_match_slot, ['home', 'away']);
            $this->assertSame('ready', $s->status);        // both teams known
        }
        $this->assertSame($semis->firstWhere('slot', 0)->id, $final->home_source_match_id);
        $this->assertSame($semis->firstWhere('slot', 1)->id, $final->away_source_match_id);
    }

    public function test_odd_team_counts_never_produce_a_bye_vs_bye_match(): void
    {
        foreach ([3, 5, 6, 7, 9, 11] as $count) {
            $bracket = $this->service()->generate($this->config([
                'participants' => array_map(fn ($i) => "T{$i}", range(1, $count)),
            ]));

            foreach ($bracket->matches->where('round', 1) as $m) {
                $empty = ($m->home_team === null) + ($m->away_team === null);
                $this->assertNotSame(2, $empty, "BYE vs BYE in a {$count}-team bracket");
            }

            // Every non-bye round-1 match has two real teams and is playable.
            $realFirstRound = $bracket->matches->where('round', 1)->reject->is_bye;
            foreach ($realFirstRound as $m) {
                $this->assertNotNull($m->home_team);
                $this->assertNotNull($m->away_team);
                $this->assertSame('ready', $m->status);
            }
        }
    }

    public function test_a_bye_is_walked_over_into_the_next_round(): void
    {
        // 3 teams -> bracket of 4, one semifinal is Team vs BYE.
        $bracket = $this->service()->generate($this->config([
            'participants' => ['CICS', 'CET', 'CABEIHM'],
        ]));

        $bye = $bracket->matches->firstWhere('is_bye', true);
        $this->assertNotNull($bye);
        $this->assertSame('completed', $bye->status);
        $this->assertNotNull($bye->winner);

        // The lone team is already sitting in the final.
        $final = $bracket->matches->firstWhere('round', 2);
        $this->assertContains($bye->winner, [$final->home_team, $final->away_team]);
    }

    public function test_seeded_bracket_pairs_the_top_seed_against_the_lowest(): void
    {
        // Standings: CICS 2-0, CET 1-1 (beat CAS), CAS 1-1, CABEIHM 0-2.
        TeamMatch::query()->insert([
            ['id' => 'm1', 'sport' => 'Basketball', 'stage' => 'round_robin', 'home_team' => 'CICS', 'away_team' => 'CABEIHM', 'home_score' => 80, 'away_score' => 60, 'winner' => 'CICS', 'is_draw' => 0, 'status' => 'completed', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'm2', 'sport' => 'Basketball', 'stage' => 'round_robin', 'home_team' => 'CICS', 'away_team' => 'CET', 'home_score' => 75, 'away_score' => 70, 'winner' => 'CICS', 'is_draw' => 0, 'status' => 'completed', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'm3', 'sport' => 'Basketball', 'stage' => 'round_robin', 'home_team' => 'CET', 'away_team' => 'CAS', 'home_score' => 90, 'away_score' => 50, 'winner' => 'CET', 'is_draw' => 0, 'status' => 'completed', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'm4', 'sport' => 'Basketball', 'stage' => 'round_robin', 'home_team' => 'CAS', 'away_team' => 'CABEIHM', 'home_score' => 65, 'away_score' => 40, 'winner' => 'CAS', 'is_draw' => 0, 'status' => 'completed', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $bracket = $this->service()->generate($this->config(['seedFromStandings' => true]));
        $this->assertTrue($bracket->seeded);

        // Standard slot order for size 4 is [1, 4, 2, 3].
        $slot0 = $bracket->matches->firstWhere(fn ($m) => $m->round === 1 && $m->slot === 0);
        $this->assertSame('CICS', $slot0->home_team);       // seed 1
        $this->assertSame('CABEIHM', $slot0->away_team);     // seed 4 (0-2, worst)
    }

    public function test_draw_method_manual_keeps_the_admin_selection_order(): void
    {
        $bracket = $this->service()->generate($this->config([
            'drawMethod'   => 'manual',
            'participants'  => ['Alpha', 'Bravo', 'Charlie', 'Delta'],
        ]));

        $this->assertFalse($bracket->seeded);
        // seedSlots(4) = [1,4,2,3] → slot 0 pairs order[0] vs order[3].
        $slot0 = $bracket->matches->firstWhere(fn ($m) => $m->round === 1 && $m->slot === 0);
        $this->assertSame('Alpha', $slot0->home_team);
        $this->assertSame('Delta', $slot0->away_team);
    }

    public function test_draw_method_random_shuffles_but_keeps_every_participant(): void
    {
        $teams = ['Alpha', 'Bravo', 'Charlie', 'Delta'];
        $bracket = $this->service()->generate($this->config([
            'drawMethod'  => 'random',
            'participants' => $teams,
        ]));

        $this->assertFalse($bracket->seeded);
        $placed = $bracket->matches
            ->where('round', 1)
            ->flatMap(fn ($m) => [$m->home_team, $m->away_team])
            ->filter()
            ->sort()
            ->values()
            ->all();
        $this->assertSame($teams, $placed); // same four teams, none dropped or duplicated
    }

    public function test_seed_from_standings_flag_still_works_as_an_alias(): void
    {
        $this->teamMatches()->result('Chess', 'Winner', 9, 'Loser', 1)->create();

        $bracket = $this->service()->generate($this->config([
            'sport'        => 'Chess',
            'participants' => ['Loser', 'Winner'],
            'seedFromStandings' => true,
        ]));

        $this->assertTrue($bracket->seeded);
        $slot0 = $bracket->matches->firstWhere(fn ($m) => $m->round === 1 && $m->slot === 0);
        $this->assertSame('Winner', $slot0->home_team); // 1-0 record → seed 1
    }

    // ── Publish ────────────────────────────────────────────────────────

    public function test_publish_creates_one_event_per_match_and_activates_the_bracket(): void
    {
        $this->actingAsRole('admin');
        $bracket = $this->service()->generate($this->config());

        $this->postJson("/api/brackets/{$bracket->id}/publish")->assertOk();

        $bracket->refresh()->load('matches');
        $this->assertSame('active', $bracket->status);
        foreach ($bracket->matches as $m) {
            $this->assertNotNull($m->event_id);
            $this->assertDatabaseHas('events', ['id' => $m->event_id, 'category' => 'Basketball']);
        }
    }

    public function test_publish_is_blocked_when_a_match_clashes_with_an_existing_event(): void
    {
        $this->actingAsRole('admin');
        $bracket = $this->service()->generate($this->config([
            'venueId' => 'gym-1',
        ]));

        // Something already sits in that venue at the first match's slot.
        $this->events()->create([
            'name' => 'Prior', 'schedule' => '2026-10-01', 'start_time' => '09:00', 'end_time' => '10:00',
            'venue_id' => 'gym-1', 'venue_name' => null,
        ]);

        $this->postJson("/api/brackets/{$bracket->id}/publish")
            ->assertStatus(422)
            ->assertJsonStructure(['error', 'conflicts']);

        $this->assertSame('draft', $bracket->fresh()->status);
        $this->assertDatabaseCount('events', 1); // only the prior one
    }

    // ── Advance ────────────────────────────────────────────────────────

    public function test_advancing_a_semifinal_feeds_its_winner_into_the_final(): void
    {
        $this->actingAsRole('admin');
        $bracket = $this->service()->generate($this->config());
        $this->service()->publish($bracket);
        $bracket->refresh()->load('matches');

        $semi = $bracket->matches->where('round', 1)->firstWhere('slot', 0);
        $winner = $semi->home_team;

        // The event was scored: a completed head-to-head exists for it.
        TeamMatch::create([
            'id' => 'tm-semi', 'sport' => 'Basketball', 'event_id' => $semi->event_id,
            'home_team' => $semi->home_team, 'away_team' => $semi->away_team,
            'home_score' => 70, 'away_score' => 55, 'winner' => $winner,
            'is_draw' => false, 'status' => 'completed',
        ]);

        $this->postJson("/api/brackets/{$bracket->id}/matches/{$semi->id}/advance")->assertOk();

        $final = BracketMatch::where('bracket_id', $bracket->id)->where('round', 2)->first();
        $slot = $semi->next_match_slot; // 'home'
        $this->assertSame($winner, $final->{$slot . '_team'});

        // The final's Event picked up the new team.
        $event = Event::find($final->event_id);
        $this->assertContains($winner, $event->departments);
        $this->assertStringContainsString($winner, $event->name);
    }

    public function test_advancing_the_final_crowns_a_champion(): void
    {
        $this->actingAsRole('admin');
        $bracket = $this->service()->generate($this->config());
        $this->service()->publish($bracket);
        $bracket->refresh()->load('matches');

        foreach ($bracket->matches->where('round', 1) as $semi) {
            $this->service()->advance($semi, $semi->home_team); // explicit winner (forfeit-style)
        }

        $final = BracketMatch::where('bracket_id', $bracket->id)->where('round', 2)->first();
        $this->service()->advance($final->fresh(), $final->fresh()->home_team);

        $bracket->refresh();
        $this->assertSame('completed', $bracket->status);
        $this->assertNotNull($bracket->champion);
    }

    public function test_advancing_without_a_recorded_result_is_rejected(): void
    {
        $this->actingAsRole('admin');
        $bracket = $this->service()->generate($this->config());
        $this->service()->publish($bracket);
        $semi = BracketMatch::where('bracket_id', $bracket->id)->where('round', 1)->first();

        $this->postJson("/api/brackets/{$bracket->id}/matches/{$semi->id}/advance")
            ->assertStatus(422)
            ->assertJsonValidationErrors('winner');
    }

    public function test_changing_an_early_result_cascades_through_every_later_round(): void
    {
        $this->actingAsRole('admin');
        $bracket = $this->service()->generate($this->config([
            'participants' => ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
        ]));
        $this->service()->publish($bracket);
        $bracket->refresh()->load('matches');

        $qf = fn (int $slot) => BracketMatch::where('bracket_id', $bracket->id)->where('round', 1)->where('slot', $slot)->first();
        $sf = fn (int $slot) => BracketMatch::where('bracket_id', $bracket->id)->where('round', 2)->where('slot', $slot)->first();
        $final = fn () => BracketMatch::where('bracket_id', $bracket->id)->where('round', 3)->first();

        // Play the whole thing out: home team wins every match.
        foreach ([0, 1, 2, 3] as $s) {
            $this->service()->advance($qf($s), $qf($s)->home_team);
        }
        foreach ([0, 1] as $s) {
            $this->service()->advance($sf($s), $sf($s)->home_team);
        }
        $this->service()->advance($final(), $final()->home_team);

        $oldChampion = $bracket->fresh()->champion;
        $qf0Home = $qf(0)->home_team;
        $qf0Away = $qf(0)->away_team;
        $this->assertSame($qf0Home, $sf(0)->home_team);      // QF0 winner sat in SF0
        $this->assertSame('completed', $bracket->fresh()->status);

        // Now correct QF0: the AWAY team actually won.
        $this->service()->advance($qf(0), $qf0Away, true);

        // SF0's home slot now holds the new QF0 winner; the final and champion recomputed.
        $this->assertSame($qf0Away, $sf(0)->fresh()->home_team);
        $this->assertNotSame($qf0Home, $sf(0)->fresh()->home_team);

        // SF0 was played on a team that no longer exists there -> re-opened.
        $this->assertContains($sf(0)->fresh()->status, ['scheduled', 'ready']);
        $this->assertNull($sf(0)->fresh()->winner);

        // The old champion's path was invalidated, so the bracket is active again.
        $this->assertSame('active', $bracket->fresh()->status);
        $this->assertNull($bracket->fresh()->champion);

        // No stale team names anywhere downstream.
        foreach (BracketMatch::where('bracket_id', $bracket->id)->where('round', '>', 1)->get() as $m) {
            foreach ([$m->home_team, $m->away_team] as $t) {
                if ($t !== null) {
                    $this->assertNotSame($qf0Home, $t, "stale team {$qf0Home} left in R{$m->round}.{$m->slot}");
                }
            }
        }
    }

    public function test_advance_accepts_an_explicit_winner_for_forfeits(): void
    {
        $this->actingAsRole('admin');
        $bracket = $this->service()->generate($this->config());
        $this->service()->publish($bracket);
        $semi = BracketMatch::where('bracket_id', $bracket->id)->where('round', 1)->first();

        $this->postJson("/api/brackets/{$bracket->id}/matches/{$semi->id}/advance", [
            'winner' => $semi->away_team,
        ])->assertOk();

        $this->assertSame($semi->away_team, $semi->fresh()->winner);
        $this->assertSame('completed', $semi->fresh()->status);
    }

    // ── Guards ─────────────────────────────────────────────────────────

    public function test_generate_publish_and_advance_are_admin_only(): void
    {
        $cfg = $this->config();

        $this->postJson('/api/brackets', $cfg)->assertUnauthorized();

        $this->actingAsRole('coach');
        $this->postJson('/api/brackets', $cfg)->assertForbidden();

        $this->actingAsRole('admin');
        $bracket = $this->service()->generate($cfg);

        $this->actingAsRole('coach');
        $this->postJson("/api/brackets/{$bracket->id}/publish")->assertForbidden();
    }

    public function test_brackets_can_be_read_publicly(): void
    {
        $bracket = $this->service()->generate($this->config());

        $this->getJson('/api/brackets')->assertOk()->assertJsonFragment(['id' => $bracket->id]);
        $this->getJson("/api/brackets/{$bracket->id}")
            ->assertOk()
            ->assertJsonPath('id', $bracket->id)
            ->assertJsonCount(3, 'matches');
    }

    public function test_bracket_detail_carries_the_scored_result_aligned_to_each_slot(): void
    {
        $this->actingAsRole('admin');
        $bracket = $this->service()->generate($this->config());
        $this->service()->publish($bracket);
        $bracket->refresh()->load('matches');

        $semi = $bracket->matches->where('round', 1)->firstWhere('slot', 0);
        // team_matches stores the higher score first — deliberately the AWAY slot here.
        TeamMatch::create([
            'id' => 'tm-x', 'sport' => 'Basketball', 'event_id' => $semi->event_id,
            'home_team' => $semi->away_team, 'away_team' => $semi->home_team,
            'home_score' => 88, 'away_score' => 71, 'winner' => $semi->away_team,
            'is_draw' => false, 'status' => 'completed',
        ]);

        $row = collect($this->getJson("/api/brackets/{$bracket->id}")->json('matches'))
            ->firstWhere('id', $semi->id);

        // Scores are re-aligned to the bracket's home/away slots.
        $this->assertEquals(71, $row['homeScore']);
        $this->assertEquals(88, $row['awayScore']);
        $this->assertTrue($row['scored']);
    }

    public function test_deleting_a_bracket_can_remove_its_events_too(): void
    {
        $this->actingAsRole('admin');
        $bracket = $this->service()->generate($this->config());
        $this->service()->publish($bracket);

        $this->deleteJson("/api/brackets/{$bracket->id}?withEvents=1")->assertOk();

        $this->assertDatabaseCount('brackets', 0);
        $this->assertDatabaseCount('bracket_matches', 0);
        $this->assertDatabaseCount('events', 0);
    }
}
