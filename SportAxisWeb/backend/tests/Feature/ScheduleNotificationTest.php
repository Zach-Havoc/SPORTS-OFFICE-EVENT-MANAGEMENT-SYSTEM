<?php

namespace Tests\Feature;

use App\Notifications\CommitteeAssigned;
use App\Notifications\ScheduleChanged;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * Creating, moving or cancelling a game tells the people it is for: coaches
 * and athletes of a competing college in that sport, and its committee.
 */
class ScheduleNotificationTest extends TestCase
{
    use RefreshDatabase;

    private $cics;

    private $cet;

    private $basketball;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();

        $this->cics = $this->departments()->create(['name' => 'College of Informatics and Computing Sciences', 'abbreviation' => 'CICS']);
        $this->cet = $this->departments()->create(['name' => 'College of Engineering', 'abbreviation' => 'CoE']);
        $this->basketball = $this->categories()->create(['name' => 'Basketball']);
    }

    private function athleteOf($college, $sport)
    {
        $user = $this->users()->athlete()->create(['department' => $college->name, 'department_id' => $college->id]);
        $this->athletes()->create(['user_id' => $user->id, 'sport' => $sport->name, 'category_id' => $sport->id]);

        return $user;
    }

    private function coachOf($college, $sport)
    {
        $coach = $this->users()->coach()->create(['department' => $college->name, 'department_id' => $college->id]);
        $coach->sportCategories()->syncWithoutDetaching([$sport->id]);

        return $coach;
    }

    private function payload(array $o = []): array
    {
        return array_merge([
            'name' => 'CICS vs CoE', 'category' => 'Basketball',
            'schedule' => now()->addDays(3)->toDateString(), 'startTime' => '09:00', 'endTime' => '10:00',
            'venueName' => 'Main Gym', 'departments' => [$this->cics->name, $this->cet->name],
        ], $o);
    }

    public function test_a_new_game_notifies_both_colleges_coaches_and_athletes_in_that_sport(): void
    {
        $athlete = $this->athleteOf($this->cics, $this->basketball);
        $coach = $this->coachOf($this->cet, $this->basketball);
        $otherSport = $this->athleteOf($this->cics, $this->categories()->create(['name' => 'Volleyball']));
        $otherCollege = $this->athleteOf($this->departments()->create(['name' => 'College of Arts', 'abbreviation' => 'CAS']), $this->basketball);

        $this->actingAsRole('admin');
        $this->postJson('/api/events', $this->payload())->assertCreated();

        Notification::assertSentTo([$athlete, $coach], ScheduleChanged::class, fn ($n) => $n->change === 'scheduled');
        Notification::assertNotSentTo([$otherSport, $otherCollege], ScheduleChanged::class);
    }

    public function test_the_committee_gets_its_assignment_email_not_a_second_new_game_notice(): void
    {
        $judge = $this->users()->judge()->create();

        $this->actingAsRole('admin');
        $this->postJson('/api/events', $this->payload([
            'judges' => [['id' => $judge->id, 'name' => $judge->name, 'email' => $judge->email]],
        ]))->assertCreated();

        Notification::assertSentTo($judge, CommitteeAssigned::class);
        Notification::assertNotSentTo($judge, ScheduleChanged::class);
    }

    public function test_moving_a_game_later_is_a_postponement_and_earlier_a_reschedule(): void
    {
        $athlete = $this->athleteOf($this->cics, $this->basketball);
        $this->actingAsRole('admin');
        $id = $this->postJson('/api/events', $this->payload())->json('id');

        $this->putJson("/api/events/{$id}", ['schedule' => now()->addDays(6)->toDateString()])->assertOk();
        Notification::assertSentTo($athlete, ScheduleChanged::class, fn ($n) => $n->change === 'postponed');

        $this->putJson("/api/events/{$id}", ['schedule' => now()->addDays(1)->toDateString()])->assertOk();
        Notification::assertSentTo($athlete, ScheduleChanged::class, fn ($n) => $n->change === 'rescheduled');
    }

    public function test_a_venue_change_says_so_and_an_unrelated_edit_sends_nothing(): void
    {
        $athlete = $this->athleteOf($this->cics, $this->basketball);
        $this->actingAsRole('admin');
        $id = $this->postJson('/api/events', $this->payload())->json('id');

        $this->putJson("/api/events/{$id}", ['name' => 'Renamed'])->assertOk();
        Notification::assertSentToTimes($athlete, ScheduleChanged::class, 1); // just the "scheduled" one

        $this->putJson("/api/events/{$id}", ['venueName' => 'Covered Court'])->assertOk();
        Notification::assertSentTo($athlete, ScheduleChanged::class, fn ($n) => $n->change === 'venue_changed'
            && str_contains(implode(' ', $n->details), 'Covered Court'));
    }

    public function test_deleting_an_upcoming_game_is_a_cancellation(): void
    {
        $athlete = $this->athleteOf($this->cics, $this->basketball);
        $this->actingAsRole('admin');
        $id = $this->postJson('/api/events', $this->payload())->json('id');

        $this->deleteJson("/api/events/{$id}")->assertOk();

        Notification::assertSentTo($athlete, ScheduleChanged::class, fn ($n) => $n->change === 'cancelled');
    }

    public function test_finished_games_do_not_notify_when_edited_or_deleted(): void
    {
        $athlete = $this->athleteOf($this->cics, $this->basketball);
        $this->actingAsRole('admin');
        $id = $this->postJson('/api/events', $this->payload(['status' => 'completed']))->json('id');

        $this->putJson("/api/events/{$id}", ['venueName' => 'Elsewhere'])->assertOk();
        $this->deleteJson("/api/events/{$id}")->assertOk();

        Notification::assertNotSentTo($athlete, ScheduleChanged::class, fn ($n) => in_array($n->change, ['venue_changed', 'cancelled']));
    }

    public function test_the_notification_is_stored_for_the_in_app_list(): void
    {
        $athlete = $this->athleteOf($this->cics, $this->basketball);
        $n = new ScheduleChanged('postponed', 'Postponed: CICS vs CoE', ['Was: Mon', 'Now: Wed'], '/');

        $this->assertSame('schedule_changed', $n->toArray($athlete)['kind']);
        $this->assertSame('Was: Mon · Now: Wed', $n->toArray($athlete)['body']);
    }
}
