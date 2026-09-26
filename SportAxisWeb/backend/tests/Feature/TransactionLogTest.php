<?php

namespace Tests\Feature;

use App\Models\Protest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/** GET /api/admin/transactions — CMO requirements, tryout applications and protests in one log. */
class TransactionLogTest extends TestCase
{
    use RefreshDatabase;

    private function seedOneOfEach(): void
    {
        $this->requirements()->create(['athlete_name' => 'Ana Reyes', 'name' => 'Parental Consent', 'status' => 'pending', 'submitted_at' => now()->subDays(3)]);
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
        $this->assertSame(['protest', 'tryout_application', 'cmo_requirement'], array_column($res->json('data'), 'type'));
        $this->assertSame(['open' => 2, 'closed' => 1], $res->json('counts'));
        $this->assertStringStartsWith('REQ-', $res->json('data.2.reference'));
    }

    public function test_it_filters_by_type_status_and_search(): void
    {
        $this->seedOneOfEach();
        $this->actingAsRole('admin');

        $this->assertSame(['cmo_requirement'], array_column($this->getJson('/api/admin/transactions?type=cmo_requirement')->json('data'), 'type'));
        $this->assertSame(['tryout_application'], array_column($this->getJson('/api/admin/transactions?status=closed')->json('data'), 'type'));
        $this->assertSame('Ben Cruz', $this->getJson('/api/admin/transactions?q=ben')->json('data.0.party'));
    }

    public function test_only_the_office_can_read_it(): void
    {
        foreach (['coach', 'judge', 'athlete'] as $role) {
            $this->actingAsRole($role);
            $this->getJson('/api/admin/transactions')->assertForbidden();
        }
    }
}
