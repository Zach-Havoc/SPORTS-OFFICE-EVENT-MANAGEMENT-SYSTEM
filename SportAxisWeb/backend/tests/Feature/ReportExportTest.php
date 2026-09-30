<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\ScoreController;
use App\Models\Event;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportExportTest extends TestCase
{
    use RefreshDatabase;

    private function scoredEvent(): Event
    {
        $this->categories()->create(['name' => 'Cheerdance', 'format' => 'ranked']);
        $event = $this->events()->create(['category' => 'Cheerdance', 'departments' => ['CICS', 'CET']]);
        $this->scores()->create(['event_id' => $event->id, 'department' => 'CICS', 'total_score' => 92]);
        $this->scores()->create(['event_id' => $event->id, 'department' => 'CET', 'total_score' => 74]);
        ScoreController::recalculateRankings($event->id);

        return $event;
    }

    public function test_only_an_admin_can_pull_reports(): void
    {
        $event = $this->scoredEvent();
        $this->actingAsRole('coach');
        $this->getJson("/api/reports/events/{$event->id}")->assertForbidden();
        $this->getJson('/api/reports/leaderboard/export?format=csv')->assertForbidden();
    }

    public function test_the_event_report_carries_rankings_scores_and_protests(): void
    {
        $event = $this->scoredEvent();
        $this->actingAsRole('admin');

        $this->getJson("/api/reports/events/{$event->id}")
            ->assertOk()
            ->assertJsonPath('event.name', $event->name)
            ->assertJsonPath('rankings.0.department', 'CICS')
            ->assertJsonPath('rankings.0.medal', 'Gold')
            ->assertJsonCount(2, 'scores');
    }

    public function test_event_export_produces_csv_and_a_printable_page(): void
    {
        $event = $this->scoredEvent();
        $this->actingAsRole('admin');

        $csv = $this->get("/api/reports/events/{$event->id}/export?format=csv");
        $csv->assertOk();
        $this->assertStringContainsString('text/csv', $csv->headers->get('content-type'));
        $this->assertStringContainsString('attachment;', $csv->headers->get('content-disposition'));
        $this->assertStringContainsString('CICS', $csv->getContent());

        $html = $this->get("/api/reports/events/{$event->id}/export?format=html");
        $html->assertOk();
        $this->assertStringContainsString('text/html', $html->headers->get('content-type'));
        $this->assertStringContainsString('Final standing', $html->getContent());
    }

    public function test_leaderboard_csv_has_the_standings_header(): void
    {
        $this->scoredEvent();
        $this->actingAsRole('admin');

        $res = $this->get('/api/reports/leaderboard/export?format=csv');
        $res->assertOk();
        $this->assertStringContainsString('Total Points', $res->getContent());
        $this->assertStringContainsString('Gold,Silver,Bronze', $res->getContent());
        // Points are the medal points (a gold = 10 by default), not the judges' raw score total.
        $this->assertStringContainsString('CICS,10,1', $res->getContent());
    }

    private function playedMatch(): Event
    {
        $event = $this->events()->create([
            'name' => 'Volleyball — Men: CICS vs CET',
            'category' => 'Volleyball — Men',
            'departments' => ['CICS', 'CET'],
            'status' => 'completed',
        ]);
        $this->teamMatches()->create([
            'event_id' => $event->id, 'sport' => 'Volleyball — Men', 'stage' => 'group',
            'home_team' => 'CICS', 'away_team' => 'CET', 'home_score' => 3, 'away_score' => 1,
            'winner' => 'CICS', 'is_draw' => false,
        ]);
        $this->liveScores()->create([
            'event_id' => $event->id, 'sport' => 'Volleyball — Men', 'home_team' => 'CICS', 'away_team' => 'CET',
            'home_score' => 3, 'away_score' => 1, 'period' => 'Set 4 · 25–20', 'status' => 'final',
            'detail' => ['bestOf' => 5, 'sets' => [[25, 18], [22, 25], [25, 23], [25, 20]]],
        ]);

        return $event;
    }

    public function test_a_match_report_carries_the_score_the_sets_and_the_winner(): void
    {
        $event = $this->playedMatch();
        $this->actingAsRole('admin');

        $this->getJson("/api/reports/events/{$event->id}")
            ->assertOk()
            ->assertJsonPath('event.format', 'versus')
            ->assertJsonPath('match.homeScore', 3)
            ->assertJsonPath('match.awayScore', 1)
            ->assertJsonPath('match.winner', 'CICS')
            ->assertJsonPath('match.stage', 'Group')
            ->assertJsonPath('match.periodUnit', 'Set')
            ->assertJsonCount(4, 'match.periods')
            ->assertJsonPath('match.periods.1', ['label' => 'Set 2', 'home' => 22, 'away' => 25]);

        // The printable page is no longer empty for a match: it shows the
        // scoreline and the set-by-set table.
        $html = $this->get("/api/reports/events/{$event->id}/export?format=html")->assertOk()->getContent();
        $this->assertStringContainsString('3 – 1', $html);
        $this->assertStringContainsString('Score by set', $html);
        $this->assertStringContainsString('CICS won.', $html);

        $csv = $this->get("/api/reports/events/{$event->id}/export?format=csv")->assertOk()->getContent();
        $this->assertStringContainsString('CICS,25,22,25,25,3', $csv);
    }

    public function test_an_unplayed_match_says_so_instead_of_printing_blank(): void
    {
        $event = $this->events()->create(['departments' => ['CICS', 'CET'], 'status' => 'completed']);
        $this->actingAsRole('admin');

        $this->getJson("/api/reports/events/{$event->id}")->assertOk()->assertJsonPath('match', null);
        $html = $this->get("/api/reports/events/{$event->id}/export?format=html")->getContent();
        $this->assertStringContainsString('No result has been recorded for this match yet.', $html);
    }

    public function test_season_results_list_every_finished_match_by_sport(): void
    {
        $this->playedMatch();
        $this->scoredEvent()->update(['status' => 'completed']);
        $this->events()->create(['category' => 'Volleyball — Men', 'status' => 'upcoming']);
        $this->actingAsRole('admin');

        $html = $this->get('/api/reports/results/export?format=html')->assertOk()->getContent();
        $this->assertStringContainsString('Volleyball — Men', $html);
        $this->assertStringContainsString('3 – 1', $html);
        $this->assertStringContainsString('2 finished events in 2 sports', $html);

        $csv = $this->get('/api/reports/results/export?format=csv&sport=Volleyball')->assertOk()->getContent();
        $this->assertStringContainsString('CICS,3,1,CET,CICS', $csv);
        $this->assertStringNotContainsString('Cheerdance', $csv);
    }

    public function test_certificates_name_the_champion_college(): void
    {
        $this->scoredEvent();
        $this->actingAsRole('admin');

        $res = $this->get('/api/reports/certificates');
        $res->assertOk();
        $this->assertStringContainsString('Overall Champion', $res->getContent());
        $this->assertStringContainsString('CICS', $res->getContent());
    }
}
