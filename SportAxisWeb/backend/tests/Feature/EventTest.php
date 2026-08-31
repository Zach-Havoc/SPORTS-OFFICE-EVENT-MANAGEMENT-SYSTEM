<?php

namespace Tests\Feature;

use App\Models\Event;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Events:
 *   GET    /api/events            (public, ordered, optional ?date= filter)
 *   GET    /api/events/{id}       (public)
 *   POST   /api/events            (admin)
 *   PUT    /api/events/{id}       (admin)
 *   DELETE /api/events/{id}       (admin)
 */
class EventTest extends TestCase
{
    use RefreshDatabase;

    public function test_event_list_is_public_and_sorted_by_schedule(): void
    {
        $this->events()->create(['name' => 'Later',  'schedule' => now()->addDays(10)->toDateString()]);
        $this->events()->create(['name' => 'Sooner', 'schedule' => now()->addDays(2)->toDateString()]);

        $names = $this->getJson('/api/events')->assertOk()->json('*.name');

        $this->assertSame(['Sooner', 'Later'], $names);
    }

    public function test_event_list_can_be_filtered_by_date(): void
    {
        $target = now()->addDays(5)->toDateString();
        $this->events()->create(['name' => 'On target', 'schedule' => $target]);
        $this->events()->create(['name' => 'Other day', 'schedule' => now()->addDays(6)->toDateString()]);

        $this->getJson('/api/events?date=' . $target)
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonFragment(['name' => 'On target']);
    }

    public function test_showing_a_single_event_returns_the_api_shape(): void
    {
        $event = $this->events()->create();

        $this->getJson("/api/events/{$event->id}")
            ->assertOk()
            ->assertJsonStructure(['id', 'name', 'category', 'schedule', 'startTime', 'endTime', 'departments', 'criteria', 'status', 'qrToken']);
    }

    public function test_showing_a_missing_event_returns_404(): void
    {
        $this->getJson('/api/events/does-not-exist')->assertNotFound();
    }

    public function test_creating_an_event_requires_an_admin(): void
    {
        $payload = [
            'name' => 'X', 'category' => 'Basketball', 'schedule' => now()->addDay()->toDateString(),
            'startTime' => '09:00', 'endTime' => '11:00', 'departments' => ['A', 'B'],
        ];

        $this->postJson('/api/events', $payload)->assertUnauthorized();

        $this->actingAsRole('coach');
        $this->postJson('/api/events', $payload)->assertForbidden();
    }

    public function test_admin_can_create_an_event_and_default_criteria_are_applied(): void
    {
        $this->actingAsRole('admin');

        $res = $this->postJson('/api/events', [
            'name'        => 'Finals',
            'category'    => 'Basketball',
            'schedule'    => now()->addDay()->toDateString(),
            'startTime'   => '09:00',
            'endTime'     => '11:00',
            'departments' => ['College of Engineering', 'College of Business'],
        ])->assertCreated();

        // A qr_token is generated and Basketball gets its 4 default criteria.
        $this->assertNotEmpty($res->json('qrToken'));
        $this->assertCount(4, $res->json('criteria'));
        $this->assertDatabaseHas('events', ['name' => 'Finals', 'status' => 'upcoming']);
    }

    public function test_explicit_criteria_are_kept(): void
    {
        $this->actingAsRole('admin');

        $res = $this->postJson('/api/events', [
            'name'        => 'Custom',
            'category'    => 'Chess',
            'schedule'    => now()->addDay()->toDateString(),
            'startTime'   => '09:00',
            'endTime'     => '11:00',
            'departments' => ['A', 'B'],
            'criteria'    => [['name' => 'Opening', 'weight' => 100]],
        ])->assertCreated();

        $this->assertCount(1, $res->json('criteria'));
        $this->assertSame('Opening', $res->json('criteria.0.name'));
    }

    public function test_event_creation_validates_required_fields_and_status(): void
    {
        $this->actingAsRole('admin');

        $this->postJson('/api/events', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'category', 'schedule', 'startTime', 'endTime', 'departments']);

        $this->postJson('/api/events', [
            'name' => 'X', 'category' => 'Basketball', 'schedule' => now()->addDay()->toDateString(),
            'startTime' => '09:00', 'endTime' => '11:00', 'departments' => ['A'], 'status' => 'bogus',
        ])->assertStatus(422)->assertJsonValidationErrors('status');
    }

    public function test_admin_can_update_and_delete_an_event(): void
    {
        $this->actingAsRole('admin');
        $event = $this->events()->create(['name' => 'Original', 'status' => 'upcoming']);

        $this->putJson("/api/events/{$event->id}", ['status' => 'ongoing'])->assertOk();
        $this->assertDatabaseHas('events', ['id' => $event->id, 'status' => 'ongoing']);

        $this->deleteJson("/api/events/{$event->id}")->assertOk();
        $this->assertDatabaseMissing('events', ['id' => $event->id]);
    }
}
