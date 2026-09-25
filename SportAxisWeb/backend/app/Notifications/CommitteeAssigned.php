<?php

namespace App\Notifications;

use App\Models\Event;
use App\Support\EventQr;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * To a committee member: the office assigned them to score an event. The
 * email carries the event's QR code as a PNG, so they can scan it from
 * another screen or open the attachment in the app's scanner; the in-app
 * notification opens the score sheet directly.
 */
class CommitteeAssigned extends Notification
{
    public function __construct(public Event $event) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return $notifiable->email ? ['database', 'mail'] : ['database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $e = $this->event;
        $when = trim(date('F j, Y', strtotime((string) $e->schedule)).' · '.$e->start_time.'–'.$e->end_time, ' ·–');
        $slug = preg_replace('/[^A-Za-z0-9]+/', '-', $e->name) ?: 'event';

        return (new MailMessage)
            ->subject("You're on the committee: {$e->name}")
            ->greeting('Hello '.($notifiable->name ?? 'Committee member').',')
            ->line("The Sports Office assigned you to score **{$e->name}** ({$e->category}).")
            ->line("When: {$when}")
            ->when($e->venue_name, fn ($m) => $m->line("Where: {$e->venue_name}"))
            ->line('Your QR code for this game is attached. In the SportsAxis app, open **Scan** and either point the camera at it or tap **Upload QR image** and pick the attachment. You can also tap this notification in the app to open the score sheet directly.')
            ->action('Open the scoring page', EventQr::url($e))
            ->line('Only assigned committee members can score this game.')
            ->attachData(EventQr::png($e), "QR-{$slug}.png", ['mime' => 'image/png']);
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'committee_assigned',
            'title' => 'Assigned to score '.$this->event->name,
            'body' => 'Tap to open the score sheet. The QR code was also emailed to you.',
            'url' => EventQr::path($this->event),
            'eventId' => $this->event->id,
        ];
    }
}
