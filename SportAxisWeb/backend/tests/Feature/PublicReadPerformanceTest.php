<?php

namespace Tests\Feature;

use App\Models\Ranking;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The public schedule's cheap-read paths:
 *   GET /api/rankings?events=a,b   several events' rankings in one request
 *   ETag / 304 on signed-out JSON reads
 *   /api/live-scores reuses its built list until a score changes
 */
class PublicReadPerformanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_batch_rankings_match_the_single_event_endpoint(): void
    {
        $a = $this->events()->create();
        $b = $this->events()->create();
        Ranking::create(['event_id' => $a->id, 'department' => 'CET', 'total_score' => 88.5, 'judge_count' => 3, 'rank' => 2]);
        Ranking::create(['event_id' => $a->id, 'department' => 'CICS', 'total_score' => 92.25, 'judge_count' => 3, 'rank' => 1]);

        $batch = $this->getJson("/api/rankings?events={$a->id},{$b->id}")->assertOk()->json();

        $this->assertSame($this->getJson("/api/rankings/{$a->id}")->json(), $batch[$a->id]);
        $this->assertSame('CICS', $batch[$a->id][0]['department']);
        $this->assertSame([], $batch[$b->id]);
    }

    public function test_batch_rankings_without_ids_is_an_empty_object(): void
    {
        $this->getJson('/api/rankings')->assertOk()->assertExactJson([]);
    }

    public function test_an_unchanged_public_read_revalidates_as_304(): void
    {
        $first = $this->getJson('/api/departments')->assertOk();
        $etag = $first->headers->get('ETag');
        $this->assertNotEmpty($etag);

        $this->getJson('/api/departments', ['If-None-Match' => $etag])
            ->assertStatus(304)
            ->assertNoContent(304);
    }

    public function test_signed_in_reads_get_no_etag(): void
    {
        $user = $this->users()->state(['role' => 'admin'])->create();
        $token = $user->createToken('test')->plainTextToken;

        $this->assertNull(
            $this->withToken($token)->getJson('/api/departments')->assertOk()->headers->get('ETag')
        );
    }

    public function test_live_scores_show_a_new_score_straight_away(): void
    {
        $event = $this->events()->create();
        $live = $this->liveScores()->inProgress()->create(['event_id' => $event->id, 'home_score' => 3]);

        $this->getJson('/api/live-scores')->assertJsonFragment(['homeScore' => 3]);

        $live->update(['home_score' => 5, 'version' => $live->version + 1]);

        $this->getJson('/api/live-scores')->assertJsonFragment(['homeScore' => 5]);
    }
}
