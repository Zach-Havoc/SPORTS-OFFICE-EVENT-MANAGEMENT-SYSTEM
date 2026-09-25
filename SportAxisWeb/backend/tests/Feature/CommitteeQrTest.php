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

    public function test_creating_an_event_notifies_each_assigned_committee_member(): void
    {
        Notification::fake();
        [$a, $b] = [$this->users()->judge()->create(), $this->users()->judge()->create()];

        $this->actingAsRole('admin');
        $this->postJson('/api/events', $this->eventPayload([$this->judgeRef($a), $this->judgeRef($b)]))->assertCreated();

        Notification::assertSentTo([$a, $b], CommitteeAssigned::class);
    }

    public function test_editing_only_notifies_the_newly_added_members(): void
    {
        Notification::fake();
        [$old, $new] = [$this->users()->judge()->create(), $this->users()->judge()->create()];
        $event = $this->events()->judgedBy($old)->create();

        $this->actingAsRole('admin');
        $this->putJson("/api/events/{$event->id}", ['judges' => [$this->judgeRef($old), $this->judgeRef($new)]])->assertOk();

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

    public function test_the_office_can_resend_the_qr_to_the_whole_committee(): void
    {
        Notification::fake();
        [$a, $b] = [$this->users()->judge()->create(), $this->users()->judge()->create()];
        $event = $this->events()->judgedBy($a, $b)->create();

        $this->actingAsRole('admin');
        $this->postJson("/api/events/{$event->id}/send-qr")->assertOk()->assertJsonPath('sent', 2);

        Notification::assertSentTo([$a, $b], CommitteeAssigned::class);
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
