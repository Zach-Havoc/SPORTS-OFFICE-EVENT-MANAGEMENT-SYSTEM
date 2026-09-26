<?php

namespace Tests\Feature;

use App\Models\Ranking;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** GET /api/events carries each completed event's winner. */
class EventResultTest extends TestCase
{
    use RefreshDatabase;

    private function resultOf(string $eventId): mixed
    {
        return collect($this->getJson('/api/events?season=all')->assertOk()->json('data'))
            ->firstWhere('id', $eventId)['result'];
    }

    public function test_a_completed_game_reports_its_head_to_head_result(): void
    {
        $event = $this->events()->completed()->create();
        $this->teamMatches()->create([
            'event_id' => $event->id, 'home_team' => 'CICS', 'away_team' => 'CET',
            'home_score' => 114, 'away_score' => 98, 'winner' => 'CICS', 'is_draw' => false,
        ]);

        $this->assertEquals([
            'type' => 'match', 'winner' => 'CICS', 'isDraw' => false,
            'homeTeam' => 'CICS', 'awayTeam' => 'CET', 'homeScore' => 114, 'awayScore' => 98,
        ], $this->resultOf($event->id));
    }

    public function test_a_drawn_game_has_no_winner(): void
    {
        $event = $this->events()->completed()->create();
        $this->teamMatches()->create([
            'event_id' => $event->id, 'home_score' => 2, 'away_score' => 2, 'winner' => null, 'is_draw' => true,
        ]);

        $result = $this->resultOf($event->id);
        $this->assertTrue($result['isDraw']);
        $this->assertNull($result['winner']);
    }

    public function test_a_completed_judged_event_reports_first_place(): void
    {
        $event = $this->events()->completed()->create(['category' => 'Cheerdance', 'departments' => ['CICS', 'CET', 'CAS']]);
        Ranking::create(['event_id' => $event->id, 'department' => 'CET', 'total_score' => 88.5, 'judge_count' => 3, 'rank' => 2]);
        Ranking::create(['event_id' => $event->id, 'department' => 'CICS', 'total_score' => 92.25, 'judge_count' => 3, 'rank' => 1]);

        $this->assertEquals(['type' => 'ranked', 'winner' => 'CICS', 'score' => 92.25], $this->resultOf($event->id));
    }

    public function test_events_that_are_not_completed_or_have_no_result_carry_null(): void
    {
        $ongoing = $this->events()->ongoing()->create();
        $this->teamMatches()->create(['event_id' => $ongoing->id]);
        $unscored = $this->events()->completed()->create();

        $this->assertNull($this->resultOf($ongoing->id));
        $this->assertNull($this->resultOf($unscored->id));
    }
}
