<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\Notification as NotificationBase;
use Tests\TestCase;

/**
 * POST /api/notifications/read-all — marks every one of the caller's unread
 * notifications read in a single batched UPDATE, without touching another
 * user's notifications.
 */
class NotificationMarkAllReadTest extends TestCase
{
    use RefreshDatabase;

    /** A minimal database notification — only `via`/`toArray` matter here. */
    private function makeNotification(): NotificationBase
    {
        return new class extends NotificationBase
        {
            public function via(object $notifiable): array
            {
                return ['database'];
            }

            public function toArray(object $notifiable): array
            {
                return ['kind' => 'test', 'title' => 'Test', 'body' => 'A test notification.'];
            }
        };
    }

    public function test_it_marks_every_unread_notification_read_for_the_caller_only(): void
    {
        $user = $this->actingAsRole('coach');
        $other = $this->users()->state(['role' => 'coach'])->create();

        foreach (range(1, 3) as $i) {
            $user->notify($this->makeNotification());
        }
        // A notification already read stays untouched (its read_at shouldn't move).
        $user->notifications()->first()->update(['read_at' => now()->subDay()]);
        $alreadyReadAt = $user->notifications()->first()->read_at;

        $other->notify($this->makeNotification());

        $this->postJson('/api/notifications/read-all')->assertOk()->assertJson(['ok' => true]);

        $this->assertSame(0, $user->unreadNotifications()->count());
        $this->assertTrue($user->notifications()->first()->read_at->equalTo($alreadyReadAt));

        // The other user's unread notification is untouched.
        $this->assertSame(1, $other->unreadNotifications()->count());
    }
}
