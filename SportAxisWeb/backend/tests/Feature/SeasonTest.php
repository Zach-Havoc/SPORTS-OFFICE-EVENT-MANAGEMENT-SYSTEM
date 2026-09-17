<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\ScoreController;
use App\Models\Event;
use App\Models\Season;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Tournament editions: one active at a time, every event attached to one, and
 * the public boards scoped to it by default.
 */
class SeasonTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_backfill_leaves_exactly_one_active_season(): void
    {
        $this->assertSame(1, Season::where('is_active', true)->count());
        $this->assertNotNull(Season::current());
    }

    public function test_a_new_event_joins_the_active_season(): void
    {
        $season = Season::current();
        $event = $this->events()->create();

        $this->assertSame($season->id, $event->fresh()->season_id);
    }

    public function test_only_an_admin_can_create_a_season(): void
    {
        $this->actingAsRole('coach');
        $this->postJson('/api/seasons', ['name' => '2099 Games'])->assertForbidden();

        $this->actingAsRole('admin');
        $this->postJson('/api/seasons', ['name' => '2099 Games'])
            ->assertCreated()
            ->assertJsonPath('name', '2099 Games')
            ->assertJsonPath('isActive', false);
    }

    public function test_activating_a_season_deactivates_the_others(): void
    {
        $this->actingAsRole('admin');
        $original = Season::current();

        $next = Season::create(['id' => (string) Str::uuid(), 'name' => '2099 Games']);
        $this->postJson("/api/seasons/{$next->id}/activate")->assertOk()->assertJsonPath('isActive', true);

        $this->assertSame(1, Season::where('is_active', true)->count());
        $this->assertFalse($original->fresh()->is_active);
        $this->assertTrue($next->fresh()->is_active);
        $this->assertSame($next->id, $this->getJson('/api/seasons/current')->json('id'));
    }

    public function test_the_leaderboard_is_scoped_to_a_season(): void
    {
        $this->actingAsRole('admin');
        $thisYear = Season::current();
        $lastYear = Season::create(['id' => (string) Str::uuid(), 'name' => 'Last Year']);

        // A ranked event with a clear winner, one per season.
        $this->scoredRankedEvent($thisYear->id, 'Cheerdance A', 'CICS');
        $this->scoredRankedEvent($lastYear->id, 'Cheerdance B', 'CET');

        // Default scope = active season → only this year's medal.
        $default = $this->getJson('/api/leaderboard')->json();
        $this->assertSame('CICS', collect($default)->firstWhere('gold', '>', 0)['department'] ?? null);

        // Explicit past season.
        $past = $this->getJson("/api/leaderboard?season={$lastYear->id}")->json();
        $this->assertSame('CET', collect($past)->firstWhere('gold', '>', 0)['department'] ?? null);

        // ?season=all combines both.
        $all = $this->getJson('/api/leaderboard?season=all')->json();
        $withGold = collect($all)->where('gold', '>', 0)->pluck('department')->sort()->values()->all();
        $this->assertSame(['CET', 'CICS'], $withGold);
    }

    public function test_a_season_with_events_cannot_be_deleted(): void
    {
        $this->actingAsRole('admin');
        $active = Season::current();
        $old = Season::create(['id' => (string) Str::uuid(), 'name' => 'Old']);
        $this->events()->create(['season_id' => $old->id]);

        $this->deleteJson("/api/seasons/{$old->id}")->assertStatus(409);
        $this->deleteJson("/api/seasons/{$active->id}")->assertStatus(422);

        $empty = Season::create(['id' => (string) Str::uuid(), 'name' => 'Empty']);
        $this->deleteJson("/api/seasons/{$empty->id}")->assertOk();
        $this->assertNull(Season::find($empty->id));
    }

    /** A ranked event scored so the given college takes gold. */
    private function scoredRankedEvent(string $seasonId, string $category, string $winner): Event
    {
        $this->categories()->create(['name' => $category, 'format' => 'ranked']);
        $event = $this->events()->create([
            'season_id' => $seasonId,
            'category' => $category,
            'departments' => [$winner, 'CABEIHM'],
        ]);
        $this->scores()->create(['event_id' => $event->id, 'department' => $winner, 'total_score' => 95]);
        $this->scores()->create(['event_id' => $event->id, 'department' => 'CABEIHM', 'total_score' => 60]);
        ScoreController::recalculateRankings($event->id);

        return $event;
    }
}
