<?php

namespace Tests\Feature;

use App\Notifications\CommitteeAssigned;
use App\Support\EventQr;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/** Assigning committee members emails them the event's QR code. */
class CommitteeQrTest extends TestCase
{
    use RefreshDatabase;

    private function judgeRef($u): array
    {
        return ['id' => $u->id, 'name' => $u->name, 'email' => $u->email];
    }

    private function eventPayload(array $judges): array
    {
        return [
            'name' => 'Basketball Finals', 'category' => 'Basketball',
            'schedule' => now()->addDay()->toDateString(), 'startTime' => '09:00', 'endTime' => '11:00',
            'departments' => ['CICS', 'CET'], 'venueName' => 'Main Gym', 'judges' => $judges,
        ];
    }

    public function test_creating_an_event_emails_the_committee_member_and_reports_who_got_it(): void
    {
        Notification::fake();
        $judge = $this->users()->judge()->create();

        $this->actingAsRole('admin');
        $this->postJson('/api/events', $this->eventPayload([$this->judgeRef($judge)]))
            ->assertCreated()
            ->assertJsonPath('committeeEmail.sent.0.email', $judge->email)
            ->assertJsonPath('committeeEmail.failed', []);

        Notification::assertSentTo($judge, CommitteeAssigned::class);
    }

    public function test_an_event_takes_only_one_committee_member(): void
    {
        [$a, $b] = [$this->users()->judge()->create(), $this->users()->judge()->create()];
        $this->actingAsRole('admin');

        $this->postJson('/api/events', $this->eventPayload([$this->judgeRef($a), $this->judgeRef($b)]))
            ->assertStatus(422)
            ->assertJsonPath('errors.judges.0', 'Only one committee member can be assigned to an event.');

        $event = $this->events()->judgedBy($a)->create();
        $this->putJson("/api/events/{$event->id}", ['judges' => [$this->judgeRef($a), $this->judgeRef($b)]])
            ->assertStatus(422);
    }

    public function test_a_failed_email_is_reported_not_hidden(): void
    {
        // Nothing listens on port 1, so the SMTP send throws.
        config(['mail.default' => 'smtp', 'mail.mailers.smtp.host' => '127.0.0.1', 'mail.mailers.smtp.port' => 1]);
        $judge = $this->users()->judge()->create();
        $event = $this->events()->judgedBy($judge)->create();

        $this->actingAsRole('admin');
        $this->postJson("/api/events/{$event->id}/send-qr")
            ->assertOk()
            ->assertJsonPath('sent', [])
            ->assertJsonPath('failed.0.email', $judge->email);
    }

    public function test_replacing_the_committee_member_notifies_only_the_new_one(): void
    {
        Notification::fake();
        [$old, $new] = [$this->users()->judge()->create(), $this->users()->judge()->create()];
        $event = $this->events()->judgedBy($old)->create();

        $this->actingAsRole('admin');
        $this->putJson("/api/events/{$event->id}", ['judges' => [$this->judgeRef($new)]])
            ->assertOk()
            ->assertJsonPath('committeeEmail.sent.0.email', $new->email);

        Notification::assertSentTo($new, CommitteeAssigned::class);
        Notification::assertNotSentTo($old, CommitteeAssigned::class);
    }

    public function test_an_edit_that_does_not_touch_the_committee_sends_nothing(): void
    {
        Notification::fake();
        $judge = $this->users()->judge()->create();
        $event = $this->events()->judgedBy($judge)->create();

        $this->actingAsRole('admin');
        $this->putJson("/api/events/{$event->id}", ['name' => 'Renamed'])->assertOk();

        Notification::assertNothingSent();
    }

    public function test_the_email_attaches_the_qr_code_png_and_the_in_app_notice_links_to_the_sheet(): void
    {
        $judge = $this->users()->judge()->create();
        $event = $this->events()->judgedBy($judge)->create();
        $n = new CommitteeAssigned($event);

        $mail = $n->toMail($judge);
        $this->assertCount(1, $mail->rawAttachments);
        $this->assertSame('image/png', $mail->rawAttachments[0]['options']['mime']);
        $this->assertStringStartsWith("\x89PNG", $mail->rawAttachments[0]['data']);
        $this->assertSame(EventQr::url($event), $mail->actionUrl);

        $data = $n->toArray($judge);
        $this->assertSame('committee_assigned', $data['kind']);
        $this->assertSame("/judge-qr/{$event->id}/{$event->qr_token}", $data['url']);
    }

    public function test_the_office_can_resend_the_qr_to_the_committee(): void
    {
        Notification::fake();
        $judge = $this->users()->judge()->create();
        $event = $this->events()->judgedBy($judge)->create();

        $this->actingAsRole('admin');
        $this->postJson("/api/events/{$event->id}/send-qr")
            ->assertOk()
            ->assertJsonPath('sent.0.name', $judge->name)
            ->assertJsonPath('sent.0.email', $judge->email);

        Notification::assertSentTo($judge, CommitteeAssigned::class);
    }

    public function test_a_second_resend_right_away_is_refused(): void
    {
        Notification::fake();
        $judge = $this->users()->judge()->create();
        $event = $this->events()->judgedBy($judge)->create();

        $this->actingAsRole('admin');
        $this->postJson("/api/events/{$event->id}/send-qr")->assertOk();
        $this->postJson("/api/events/{$event->id}/send-qr")->assertStatus(429);

        Notification::assertSentToTimes($judge, CommitteeAssigned::class, 1);
    }

    public function test_resending_with_no_committee_says_so(): void
    {
        $event = $this->events()->create();

        $this->actingAsRole('admin');
        $this->postJson("/api/events/{$event->id}/send-qr")->assertStatus(422);
    }

    public function test_only_the_office_can_resend(): void
    {
        $event = $this->events()->create();

        foreach (['coach', 'judge', 'athlete'] as $role) {
            $this->actingAsRole($role);
            $this->postJson("/api/events/{$event->id}/send-qr")->assertForbidden();
        }
    }
}
