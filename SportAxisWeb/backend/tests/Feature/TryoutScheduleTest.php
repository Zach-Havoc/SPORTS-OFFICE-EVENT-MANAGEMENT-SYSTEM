<?php

namespace Tests\Feature;

use App\Notifications\ScheduleChanged;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/** A tryout announcement carries its date, time and venue; applicants hear when it moves. */
class TryoutScheduleTest extends TestCase
{
    use RefreshDatabase;

    private function postTryout(array $o = [])
    {
        return $this->postJson('/api/announcements', array_merge([
            'title' => 'Basketball tryouts', 'content' => 'Bring your PE uniform.', 'isTryout' => true,
            'tryoutDate' => now()->addDays(7)->toDateString(), 'tryoutStartTime' => '14:00',
            'tryoutEndTime' => '17:00', 'tryoutVenue' => 'Main Gym',
        ], $o));
    }

    public function test_a_tryout_keeps_its_schedule(): void
    {
        $this->actingAsRole('coach');

        $this->postTryout()->assertCreated()
            ->assertJsonPath('tryout_venue', 'Main Gym')
            ->assertJsonPath('tryout_start_time', '14:00');
    }

    public function test_a_tryout_cannot_take_a_venue_booked_for_a_game(): void
    {
        $this->events()->create([
            'name' => 'CICS vs CoE', 'schedule' => now()->addDays(7)->toDateString(),
            'start_time' => '15:00', 'end_time' => '16:00', 'venue_name' => 'Main Gym',
        ]);
        $this->actingAsRole('coach');

        $this->postTryout()->assertStatus(422)->assertJsonFragment(['error' => 'Main Gym is booked for CICS vs CoE (15:00–16:00) that day.']);
    }

    public function test_moving_the_tryout_emails_applicants_still_in_the_running(): void
    {
        Notification::fake();
        $coach = $this->actingAsRole('coach');
        $id = $this->postTryout()->json('id');
        $this->tryouts()->create(['announcement_id' => $id, 'coach_id' => $coach->id, 'email' => 'pending@batstate-u.edu.ph']);
        $this->tryouts()->create(['announcement_id' => $id, 'coach_id' => $coach->id, 'email' => 'no@batstate-u.edu.ph', 'status' => 'rejected']);

        $this->putJson("/api/announcements/{$id}", ['tryoutVenue' => 'Covered Court'])->assertOk();

        Notification::assertSentOnDemand(ScheduleChanged::class, function ($n, $channels, AnonymousNotifiable $to) {
            return $channels === ['mail'] && $to->routes['mail'] === 'pending@batstate-u.edu.ph'
                && str_contains(implode(' ', $n->details), 'Covered Court');
        });
        Notification::assertSentOnDemandTimes(ScheduleChanged::class, 1);
    }

    public function test_editing_only_the_text_sends_nothing(): void
    {
        Notification::fake();
        $coach = $this->actingAsRole('coach');
        $id = $this->postTryout()->json('id');
        $this->tryouts()->create(['announcement_id' => $id, 'coach_id' => $coach->id]);

        $this->putJson("/api/announcements/{$id}", ['content' => 'Bring water too.'])->assertOk();

        Notification::assertNothingSent();
    }
}
