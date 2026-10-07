<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\Protest;
use App\Models\User;
use App\Notifications\ProtestCounterFiled;
use App\Notifications\ProtestCounterRequested;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The protest process: a college files within 12 hours after its game, with
 * the formal protest form (PDF); the office may ask the other team for a
 * counter, which that team files with its own form within 12 hours; then the
 * office decides.
 *
 * The game is Oct 7, 9:00-11:00 AM Manila time (01:00-03:00 UTC), so the
 * filing window closes at 11:00 PM Manila (15:00 UTC).
 */
class ProtestProcessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        $this->travelTo(Carbon::parse('2026-10-07 05:00:00', 'UTC')); // 1:00 PM in Manila
    }

    private function game(array $attrs = []): Event
    {
        return $this->events()->create($attrs + [
            'name' => 'Volleyball — Men: CICS vs CET',
            'category' => 'Volleyball — Men',
            'schedule' => '2026-10-07',
            'start_time' => '09:00',
            'end_time' => '11:00',
            'departments' => ['CICS', 'CET'],
            'status' => 'completed',
        ]);
    }

    private function pdf(string $name = 'form.pdf'): UploadedFile
    {
        return UploadedFile::fake()->create($name, 120, 'application/pdf');
    }

    private function file(Event $event, array $over = [])
    {
        return $this->post('/api/protests', $over + [
            'eventId' => $event->id,
            'reason' => 'The final set score was entered for the wrong team.',
            'form' => $this->pdf(),
        ], ['Accept' => 'application/json']);
    }

    public function test_a_team_files_a_protest_with_its_formal_form(): void
    {
        $event = $this->game();
        $this->actingAsRole('coach', ['department' => 'CICS']);

        $res = $this->file($event)->assertCreated()->assertJsonPath('status', 'open');

        $this->assertStringContainsString('/storage/protests/', $res->json('formUrl'));
        Storage::disk('public')->assertExists('protests/'.basename($res->json('formUrl')));
    }

    public function test_the_formal_form_is_required_and_must_be_a_pdf(): void
    {
        $event = $this->game();
        $this->actingAsRole('coach', ['department' => 'CICS']);

        $this->file($event, ['form' => null])->assertJsonValidationErrors(['form']);
        $this->file($event, ['form' => UploadedFile::fake()->create('form.docx', 50, 'application/msword')])
            ->assertJsonValidationErrors(['form']);
    }

    public function test_the_protest_window_closes_12_hours_after_the_game(): void
    {
        $event = $this->game();
        $this->actingAsRole('coach', ['department' => 'CICS']);

        $this->travelTo(Carbon::parse('2026-10-07 15:01:00', 'UTC')); // 11:01 PM Manila
        $this->file($event)->assertStatus(422)->assertJsonPath('error', fn ($e) => str_contains($e, 'window'));
    }

    public function test_only_a_college_that_played_can_protest_and_only_once_at_a_time(): void
    {
        $event = $this->game();

        $this->actingAsRole('coach', ['department' => 'CAS']);
        $this->file($event)->assertStatus(422);

        $this->actingAsRole('coach', ['department' => 'CICS']);
        $this->file($event)->assertCreated();
        $this->file($event)->assertStatus(422); // already under review
    }

    public function test_the_coach_sees_only_games_still_open_for_a_protest(): void
    {
        $open = $this->game();
        $this->game(['name' => 'Old game', 'schedule' => '2026-10-05']); // window long closed
        $this->game(['name' => 'Other colleges', 'departments' => ['CAS', 'LS']]);

        $this->actingAsRole('coach', ['department' => 'CICS']);
        $this->getJson('/api/protests/eligible-games')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $open->id)
            ->assertJsonPath('0.deadline', '2026-10-07T15:00:00+00:00');
    }

    public function test_the_office_asks_for_a_counter_and_the_other_team_files_it(): void
    {
        Notification::fake();
        $event = $this->game();
        $this->actingAsRole('coach', ['department' => 'CICS']);
        $id = $this->file($event)->json('id');
        $cet = $this->users()->coach()->create(['department' => 'CET', 'active' => true]);

        // The office asks CET; they have 12 hours.
        $this->actingAsRole('admin');
        $this->postJson("/api/protests/{$id}/request-counter")
            ->assertOk()
            ->assertJsonPath('status', 'awaiting_counter')
            ->assertJsonPath('counterDepartment', 'CET')
            ->assertJsonPath('counterDueAt', fn ($t) => str_starts_with((string) $t, '2026-10-07T17:00'));
        Notification::assertSentTo($cet, ProtestCounterRequested::class);

        // The office can't decide while CET's window is open.
        $this->postJson("/api/protests/{$id}/resolve", ['status' => 'dismissed', 'resolution' => 'Result stands as recorded.'])
            ->assertStatus(422);

        // Another college can't file CET's counter.
        $this->actingAsRole('coach', ['department' => 'CAS']);
        $this->post("/api/protests/{$id}/counter", ['reason' => 'We were not even in this game at all.', 'form' => $this->pdf()], ['Accept' => 'application/json'])
            ->assertForbidden();

        // CET files its counter with its form; the protest is ready for a decision.
        $this->actingAs($cet);
        $this->post("/api/protests/{$id}/counter", [
            'reason' => 'The scorer read the sheet correctly; the set went to CET.',
            'form' => $this->pdf('counter.pdf'),
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('status', 'open')
            ->assertJsonPath('counterFormUrl', fn ($u) => str_contains((string) $u, '/storage/protests/'));
        Notification::assertSentTo(User::where('role', 'admin')->first(), ProtestCounterFiled::class);

        $this->actingAsRole('admin');
        $this->postJson("/api/protests/{$id}/resolve", ['status' => 'dismissed', 'resolution' => 'Both forms reviewed; the result stands.'])
            ->assertOk()->assertJsonPath('status', 'dismissed');
    }

    public function test_a_late_counter_is_refused_and_the_office_can_then_decide(): void
    {
        Notification::fake();
        $event = $this->game();
        $this->actingAsRole('coach', ['department' => 'CICS']);
        $id = $this->file($event)->json('id');

        $this->actingAsRole('admin');
        $this->postJson("/api/protests/{$id}/request-counter")->assertOk();

        $this->travelTo(Carbon::parse('2026-10-07 17:01:00', 'UTC')); // 12 hours and a minute later
        $this->actingAsRole('coach', ['department' => 'CET']);
        $this->post("/api/protests/{$id}/counter", ['reason' => 'Sorry, we are late with this counter.', 'form' => $this->pdf()], ['Accept' => 'application/json'])
            ->assertStatus(422);

        $this->actingAsRole('admin');
        $this->getJson('/api/protests')->assertJsonPath('0.counterLapsed', true);
        $this->postJson("/api/protests/{$id}/resolve", ['status' => 'upheld', 'resolution' => 'No counter came in time; upheld.'])
            ->assertOk()->assertJsonPath('status', 'upheld');
    }

    public function test_a_protest_waiting_for_a_counter_stays_in_the_office_queue(): void
    {
        $event = $this->game();
        $coach = $this->users()->coach()->create(['department' => 'CICS']);
        Protest::create(['id' => 'p1', 'event_id' => $event->id, 'filed_by' => $coach->id, 'department' => 'CICS',
            'reason' => str_repeat('r', 20), 'status' => 'awaiting_counter', 'counter_department' => 'CET',
            'counter_due_at' => now()->addHours(5)]);

        $this->actingAsRole('admin');
        $this->getJson('/api/admin/transactions?status=open')->assertJsonPath('counts.open', 1);
    }
}
