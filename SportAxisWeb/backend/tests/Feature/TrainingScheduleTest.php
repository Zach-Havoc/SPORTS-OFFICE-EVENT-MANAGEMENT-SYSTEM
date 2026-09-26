<?php

namespace Tests\Feature;

use App\Models\AttendanceSession;
use App\Notifications\ScheduleChanged;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/** Training sessions carry a time and venue, can be generated weekly, and tell the roster. */
class TrainingScheduleTest extends TestCase
{
    use RefreshDatabase;

    private $coach;

    private $athlete;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        Carbon::setTestNow('2026-10-05 08:00:00'); // a Monday

        $this->coach = $this->users()->coach()->create();
        $this->athlete = $this->users()->athlete()->create(['coach_id' => $this->coach->id]);
        $this->loginAs($this->coach);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_a_session_keeps_its_time_and_venue_and_the_roster_is_told(): void
    {
        $this->postJson('/api/attendance/sessions', [
            'title' => 'Morning drills', 'date' => '2026-10-07',
            'startTime' => '06:00', 'endTime' => '08:00', 'venueName' => 'Main Gym',
        ])->assertCreated()
            ->assertJsonPath('startTime', '06:00')
            ->assertJsonPath('venueName', 'Main Gym');

        Notification::assertSentTo($this->athlete, ScheduleChanged::class, fn ($n) => $n->change === 'scheduled');
    }

    public function test_the_end_time_must_come_after_the_start(): void
    {
        $this->postJson('/api/attendance/sessions', [
            'title' => 'Drills', 'date' => '2026-10-07', 'startTime' => '08:00', 'endTime' => '07:00',
        ])->assertStatus(422)->assertJsonValidationErrors('endTime');
    }

    public function test_the_weekly_generator_creates_one_session_per_chosen_weekday(): void
    {
        $res = $this->postJson('/api/attendance/sessions/recurring', [
            'title' => 'Team training', 'from' => '2026-10-05', 'to' => '2026-10-18',
            'weekdays' => [1, 3, 5], // Mon, Wed, Fri
            'startTime' => '16:00', 'endTime' => '18:00', 'venueName' => 'Main Gym',
        ])->assertCreated();

        $this->assertCount(6, $res->json('created'));
        $this->assertSame(['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12', '2026-10-14', '2026-10-16'],
            AttendanceSession::orderBy('date')->get()->map(fn ($s) => $s->date->toDateString())->all());

        // One notification for the whole schedule, not six.
        Notification::assertSentToTimes($this->athlete, ScheduleChanged::class, 1);
    }

    public function test_the_generator_skips_days_the_venue_is_booked_for_a_game_and_duplicates(): void
    {
        $this->events()->create([
            'name' => 'CICS vs CoE', 'schedule' => '2026-10-07', 'start_time' => '17:00', 'end_time' => '18:30',
            'venue_name' => 'Main Gym',
        ]);
        AttendanceSession::create([
            'id' => 'existing', 'coach_id' => $this->coach->id, 'title' => 'Team training',
            'date' => '2026-10-09', 'created_by' => $this->coach->id,
        ]);

        $res = $this->postJson('/api/attendance/sessions/recurring', [
            'title' => 'Team training', 'from' => '2026-10-05', 'to' => '2026-10-11',
            'weekdays' => [1, 3, 5], 'startTime' => '16:00', 'endTime' => '18:00', 'venueName' => 'Main Gym',
        ])->assertCreated();

        $this->assertCount(1, $res->json('created'));
        $this->assertSame(['2026-10-07', '2026-10-09'], array_column($res->json('skipped'), 'date'));
        $this->assertStringContainsString('CICS vs CoE', $res->json('skipped.0.reason'));
    }

    public function test_a_schedule_cannot_span_more_than_180_days(): void
    {
        $this->postJson('/api/attendance/sessions/recurring', [
            'title' => 'Season', 'from' => '2026-10-05', 'to' => '2027-06-01', 'weekdays' => [1],
        ])->assertStatus(422)->assertJsonValidationErrors('to');
    }

    public function test_moving_or_cancelling_an_upcoming_session_tells_the_roster(): void
    {
        $id = $this->postJson('/api/attendance/sessions', ['title' => 'Drills', 'date' => '2026-10-07', 'startTime' => '06:00'])->json('id');

        $this->putJson("/api/attendance/sessions/{$id}", ['date' => '2026-10-08'])->assertOk();
        Notification::assertSentTo($this->athlete, ScheduleChanged::class, fn ($n) => $n->change === 'postponed');

        $this->putJson("/api/attendance/sessions/{$id}", ['venueName' => 'Field B'])->assertOk();
        Notification::assertSentTo($this->athlete, ScheduleChanged::class, fn ($n) => $n->change === 'venue_changed');

        $this->deleteJson("/api/attendance/sessions/{$id}")->assertOk();
        Notification::assertSentTo($this->athlete, ScheduleChanged::class, fn ($n) => $n->change === 'cancelled');
    }

    public function test_past_sessions_are_not_announced(): void
    {
        $this->postJson('/api/attendance/sessions', ['title' => 'Last week', 'date' => '2026-09-28'])->assertCreated();

        Notification::assertNothingSent();
    }

    public function test_an_athlete_sees_their_coachs_upcoming_training(): void
    {
        $this->postJson('/api/attendance/sessions', ['title' => 'Past', 'date' => '2026-10-01']);
        $this->postJson('/api/attendance/sessions', ['title' => 'Next', 'date' => '2026-10-09', 'startTime' => '16:00', 'venueName' => 'Main Gym']);
        $other = $this->users()->coach()->create();
        AttendanceSession::create(['id' => 'x', 'coach_id' => $other->id, 'title' => 'Not mine', 'date' => '2026-10-10', 'created_by' => $other->id]);

        $this->loginAs($this->athlete);
        $res = $this->getJson('/api/athlete/training')->assertOk();

        $this->assertSame(['Next'], array_column($res->json(), 'title'));
        $this->assertSame($this->coach->name, $res->json('0.coachName'));
    }
}
