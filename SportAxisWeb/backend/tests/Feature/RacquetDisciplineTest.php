<?php

namespace Tests\Feature;

use App\Models\BracketMatch;
use App\Services\BracketService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Racquet sports (Badminton, Table Tennis) run each line — Singles A, Singles
 * B, Doubles — as its own bracket over the colleges, with its own medals.
 * Each line is a normal `versus` category so the bracket engine, auto-advance,
 * and medal table apply unchanged; a parent-sport filter rolls the lines up.
 */
class RacquetDisciplineTest extends TestCase
{
    use RefreshDatabase;

    private const PARTICIPANTS = ['CICS', 'CET', 'CABEIHM', 'CAS'];

    private function service(): BracketService
    {
        return app(BracketService::class);
    }

    /** Generate + publish a line bracket; return it fresh with matches. */
    private function lineBracket(string $category)
    {
        $bracket = $this->service()->generate([
            'sport' => $category,
            'format' => 'single_elimination',
            'participants' => self::PARTICIPANTS,
            'startDate' => '2026-10-01',
            'startTime' => '09:00',
        ]);
        $this->service()->publish($bracket);

        return $bracket->fresh('matches');
    }

    /** Home team wins every match → seed #1 (CICS) is champion. */
    private function playOut($bracket): void
    {
        foreach ($bracket->matches->where('round', 1) as $semi) {
            $this->service()->advance($semi->fresh(), $semi->home_team);
        }
        $final = BracketMatch::where('bracket_id', $bracket->id)->where('round', 2)->first();
        $this->service()->advance($final->fresh(), $final->fresh()->home_team);
    }

    public function test_the_seed_migration_creates_the_twelve_line_categories(): void
    {
        $cats = collect($this->getJson('/api/categories')->assertOk()->json())->keyBy('name');

        foreach (['Badminton', 'Table Tennis'] as $sport) {
            foreach (['M Singles A', 'M Singles B', 'M Doubles', 'W Singles A', 'W Singles B', 'W Doubles'] as $div) {
                $row = $cats->get("{$sport} — {$div}");
                $this->assertNotNull($row, "missing category {$sport} — {$div}");
                $this->assertSame('versus', $row['format']);
                $this->assertSame($sport, $row['parent_sport']);
                $this->assertSame($div, $row['division']);
            }
        }
    }

    public function test_a_line_bracket_scores_and_auto_advances_like_any_versus_bracket(): void
    {
        $this->actingAsRole('admin');
        $bracket = $this->lineBracket('Badminton — M Singles A');

        $semi = $bracket->matches->where('round', 1)->firstWhere('slot', 0);

        $this->postJson('/api/scores', ['eventId' => $semi->event_id, 'department' => $semi->home_team, 'totalScore' => 2])->assertCreated();
        $this->postJson('/api/scores', ['eventId' => $semi->event_id, 'department' => $semi->away_team, 'totalScore' => 0])->assertCreated();

        $final = BracketMatch::where('bracket_id', $bracket->id)->where('round', 2)->first();
        $this->assertContains($semi->fresh()->home_team, [$final->home_team, $final->away_team]);
    }

    public function test_parent_sport_leaderboard_sums_finished_line_podiums(): void
    {
        $this->actingAsRole('admin');

        $this->playOut($this->lineBracket('Badminton — M Singles A'));
        $this->playOut($this->lineBracket('Badminton — M Singles B'));
        $this->lineBracket('Badminton — M Doubles'); // generated but not played

        $board = collect($this->getJson('/api/leaderboard?parentSport=Badminton')->assertOk()->json());

        // Two finished lines → CICS (seed #1) is champion of both; the unplayed
        // Doubles line adds nothing.
        $this->assertSame(2, $board->firstWhere('department', 'CICS')['gold']);
        $this->assertSame(2, $board->sum('gold'));
    }

    public function test_bracket_show_labels_each_side_with_the_athlete_and_college_abbrev(): void
    {
        $this->actingAsRole('admin');
        $this->departments()->create(['name' => 'CET', 'abbreviation' => 'CET']);
        $this->disciplineEntries()->create([
            'category' => 'Badminton — M Singles A', 'department' => 'CET', 'athlete_name' => 'Santos',
        ]);

        $bracket = $this->lineBracket('Badminton — M Singles A');

        $data = $this->getJson("/api/brackets/{$bracket->id}")->assertOk()->json();
        $labels = collect($data['matches'])->flatMap(fn ($m) => [$m['homeLabel'], $m['awayLabel']])->filter();

        $this->assertContains('Santos (CET)', $labels->all());
    }

    public function test_a_plain_sport_bracket_carries_no_discipline_labels(): void
    {
        $this->actingAsRole('admin');
        $this->categories()->create(['name' => 'Basketball', 'format' => 'versus']);

        $bracket = $this->lineBracket('Basketball');

        $data = $this->getJson("/api/brackets/{$bracket->id}")->assertOk()->json();
        foreach ($data['matches'] as $m) {
            $this->assertNull($m['homeLabel']);
            $this->assertNull($m['awayLabel']);
        }
    }
}
