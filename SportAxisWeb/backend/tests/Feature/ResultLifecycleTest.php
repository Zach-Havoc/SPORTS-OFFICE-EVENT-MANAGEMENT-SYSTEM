<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\ScoreController;
use App\Models\Protest;
use App\Models\Ranking;
use App\Models\Score;
use App\Models\ScoreAmendment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Verified/official scores decide the table; disputed ones are held out. Every
 * after-the-fact edit leaves an amendment trail. Coaches file protests; the
 * sports office resolves them.
 */
class ResultLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private function twoScores(): array
    {
        $event = $this->events()->create(['category' => 'Cheerdance']);
        $a = $this->scores()->create(['event_id' => $event->id, 'department' => 'CICS', 'total_score' => 90]);
        $b = $this->scores()->create(['event_id' => $event->id, 'department' => 'CET', 'total_score' => 70]);
        ScoreController::recalculateRankings($event->id);

        return [$event, $a, $b];
    }

    public function test_a_new_score_is_verified_and_counts(): void
    {
        [$event, $a] = $this->twoScores();
        $this->assertSame('verified', $a->fresh()->status);
        $this->assertSame(2, Ranking::where('event_id', $event->id)->count());
    }

    public function test_disputing_a_score_removes_it_from_the_table_and_verifying_restores_it(): void
    {
        [$event, $a] = $this->twoScores();
        $this->actingAsRole('admin');

        $this->postJson("/api/scores/{$a->id}/dispute", ['reason' => 'Clerical error on the tally sheet.'])
            ->assertOk()
            ->assertJsonPath('score.status', 'disputed');

        $this->assertSame(1, Ranking::where('event_id', $event->id)->count());
        $this->assertSame('CET', Ranking::where('event_id', $event->id)->value('department'));

        $this->postJson("/api/scores/{$a->id}/verify")->assertOk()->assertJsonPath('score.status', 'verified');
        $this->assertSame(2, Ranking::where('event_id', $event->id)->count());
        $this->assertSame('CICS', Ranking::where('event_id', $event->id)->where('rank', 1)->value('department'));
    }

    public function test_a_dispute_needs_a_reason(): void
    {
        [, $a] = $this->twoScores();
        $this->actingAsRole('admin');
        $this->postJson("/api/scores/{$a->id}/dispute", [])->assertJsonValidationErrors('reason');
    }

    public function test_amending_a_score_writes_a_trail_and_reranks(): void
    {
        [$event, $a, $b] = $this->twoScores();
        $this->actingAsRole('judge');

        // CET overtakes CICS after the correction.
        $this->postJson("/api/scores/{$b->id}/amend", [
            'totalScore' => 99,
            'reason' => 'Judge 2 sheet was transposed; corrected to 99.',
        ])->assertOk();

        $amend = ScoreAmendment::where('score_id', $b->id)->first();
        $this->assertNotNull($amend);
        $this->assertEquals(70, (float) $amend->old_total);
        $this->assertEquals(99, (float) $amend->new_total);
        $this->assertStringContainsString('transposed', $amend->reason);

        $this->assertSame('CET', Ranking::where('event_id', $event->id)->where('rank', 1)->value('department'));
    }

    public function test_an_amendment_requires_a_reason(): void
    {
        [, $a] = $this->twoScores();
        $this->actingAsRole('admin');
        $this->postJson("/api/scores/{$a->id}/amend", ['totalScore' => 88])
            ->assertJsonValidationErrors('reason');
    }

    public function test_officialize_locks_verified_scores(): void
    {
        [$event] = $this->twoScores();
        $this->actingAsRole('admin');

        $this->postJson("/api/events/{$event->id}/officialize")
            ->assertOk()
            ->assertJsonPath('officialized', 2);

        $this->assertSame(2, Score::where('event_id', $event->id)->where('status', 'official')->count());
        $this->assertSame(2, Ranking::where('event_id', $event->id)->count());
    }

    public function test_a_coach_files_a_protest_and_the_office_resolves_it(): void
    {
        [$event] = $this->twoScores();

        $coach = $this->actingAsRole('coach', ['department' => 'CICS']);
        $filed = $this->postJson('/api/protests', [
            'eventId' => $event->id,
            'reason' => 'The final tally does not match the score sheet our representative signed.',
        ])->assertCreated()->assertJsonPath('status', 'open')->json();

        // The admin sees it and resolves it.
        $admin = $this->actingAsRole('admin');
        $this->getJson('/api/protests')->assertOk()->assertJsonFragment(['id' => $filed['id']]);

        $this->postJson("/api/protests/{$filed['id']}/resolve", [
            'status' => 'upheld',
            'resolution' => 'Reviewed the sheet; the tally was wrong and has been amended.',
        ])->assertOk()->assertJsonPath('status', 'upheld')->assertJsonPath('resolverName', $admin->name);

        $this->assertSame('CICS', Protest::find($filed['id'])->department);
    }

    public function test_a_coach_cannot_resolve_a_protest(): void
    {
        [$event] = $this->twoScores();
        $coach = $this->actingAsRole('coach', ['department' => 'CET']);
        $p = Protest::create([
            'id' => (string) Str::uuid(),
            'event_id' => $event->id,
            'filed_by' => $coach->id,
            'department' => 'CET',
            'reason' => str_repeat('x', 20),
            'status' => 'open',
        ]);

        $this->postJson("/api/protests/{$p->id}/resolve", ['status' => 'dismissed', 'resolution' => str_repeat('y', 15)])
            ->assertForbidden();
    }

    public function test_a_protest_needs_a_real_event_and_a_substantive_reason(): void
    {
        $this->actingAsRole('coach', ['department' => 'CICS']);
        $this->postJson('/api/protests', ['eventId' => 'nope', 'reason' => 'too short'])
            ->assertJsonValidationErrors(['eventId', 'reason']);
    }
}
