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
        $this->assertStringContainsString('CICS,92,1', $res->getContent());
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
