<?php

namespace App\Notifications;

use App\Models\Protest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * To the other team's coaches: the office wants their counter to a protest,
 * with their formal counter form, within 12 hours. Email too, since the
 * window is short.
 */
class ProtestCounterRequested extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Protest $protest) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return $notifiable->email ? ['database', 'mail'] : ['database'];
    }

    private function due(): string
    {
        return $this->protest->counter_due_at
            ?->setTimezone(config('sportaxis.local_timezone', 'Asia/Manila'))
            ->format('M j, g:i A') ?? 'within 12 hours';
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Counter requested: '.($this->protest->event?->name ?? 'a game'))
            ->greeting('Hello '.($notifiable->name ?? 'Coach').',')
            ->line("{$this->protest->department} filed a protest about {$this->protest->event?->name}.")
            ->line("The sports office is asking your college for a counter. Submit your counter statement and the formal counter form (PDF) by **{$this->due()}**.")
            ->action('Open Appeals', rtrim((string) config('app.frontend_url'), '/').'/coach/protests')
            ->line('After that time the window closes and the office decides without it.');
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'protest_counter_requested',
            'title' => 'Counter requested',
            'body' => "Submit your counter to {$this->protest->department}'s protest about {$this->protest->event?->name} by {$this->due()}.",
            'url' => '/coach/protests',
            'protestId' => $this->protest->id,
        ];
    }
}
