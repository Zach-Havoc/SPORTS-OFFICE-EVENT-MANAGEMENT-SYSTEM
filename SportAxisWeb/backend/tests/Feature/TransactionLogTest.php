<?php

namespace Tests\Feature;

use App\Models\CmoSubmission;
use App\Models\Protest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/** GET /api/admin/transactions — CMO requirements and protests in one log (tryouts are the coaches'). */
class TransactionLogTest extends TestCase
{
    use RefreshDatabase;

    private function seedOneOfEach(): void
    {
        // Two CMO submissions from a coach: one waiting for the office, one accepted.
        $cmoCoach = $this->users()->coach()->create(['department' => 'CICS']);
        foreach ([['Ana Reyes', 'submitted', 3], ['Ben Cruz', 'accepted', 2]] as [$name, $status, $days]) {
            $sub = CmoSubmission::create(['id' => (string) Str::uuid(), 'coach_id' => $cmoCoach->id,
                'department' => 'CICS', 'sport' => 'Basketball', 'submitted_at' => now()->subDays($days)]);
            $sub->athletes()->create(['athlete_id' => (string) Str::uuid(), 'athlete_name' => $name, 'department' => 'CICS',
                'sport' => 'Basketball', 'status' => $status, 'reviewed_at' => $status === 'accepted' ? now() : null]);
        }
        $this->tryouts()->create(['first_name' => 'Ben', 'last_name' => 'Cruz', 'sport' => 'Volleyball', 'status' => 'accepted', 'applied_at' => now()->subDays(2), 'reviewed_at' => now()]);
        $event = $this->events()->create(['name' => 'CICS vs CoE']);
        $coach = $this->users()->coach()->create();
        Protest::create(['id' => (string) Str::uuid(), 'event_id' => $event->id, 'filed_by' => $coach->id, 'department' => 'CICS',
            'reason' => 'The final score was entered for the wrong team.', 'status' => 'open']);
    }

    public function test_the_office_sees_every_kind_newest_first(): void
    {
        $this->seedOneOfEach();
        $this->actingAsRole('admin');

        $res = $this->getJson('/api/admin/transactions')->assertOk();

        $this->assertSame(3, $res->json('total'));
        $this->assertSame(['protest', 'cmo_requirement', 'cmo_requirement'], array_column($res->json('data'), 'type'));
        $this->assertSame([
            'open' => 2, 'closed' => 1,
            'byType' => ['cmo_requirement' => 2, 'protest' => 1],
        ], $res->json('counts'));
        $this->assertStringStartsWith('CMO-', $res->json('data.2.reference'));
    }

    public function test_it_filters_by_type_status_and_search(): void
    {
        $this->seedOneOfEach();
        $this->actingAsRole('admin');

        $this->assertSame(['cmo_requirement', 'cmo_requirement'], array_column($this->getJson('/api/admin/transactions?type=cmo_requirement')->json('data'), 'type'));
        $this->assertSame(['cmo_requirement'], array_column($this->getJson('/api/admin/transactions?status=closed')->json('data'), 'type'));
        $this->assertSame('APL-', substr($this->getJson('/api/admin/transactions?q=CoE')->json('data.0.reference'), 0, 4));
    }

    public function test_tryout_applications_stay_out_of_the_office_queue(): void
    {
        $this->tryouts()->create(['first_name' => 'Cara', 'last_name' => 'Lim', 'sport' => 'Volleyball', 'status' => 'pending', 'applied_at' => now()]);
        $this->actingAsRole('admin');

        $this->getJson('/api/admin/transactions')->assertOk()->assertJsonPath('total', 0);
        $this->getJson('/api/admin/transactions?type=tryout_application')->assertUnprocessable();
    }

    public function test_only_the_office_can_read_it(): void
    {
        foreach (['coach', 'judge', 'athlete'] as $role) {
            $this->actingAsRole($role);
            $this->getJson('/api/admin/transactions')->assertForbidden();
        }
    }
}
