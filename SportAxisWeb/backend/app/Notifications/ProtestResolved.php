<?php

namespace App\Notifications;

use App\Models\Protest;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** To the coach who filed it: the sports office has ruled on a protest. */
class ProtestResolved extends Notification
{
    public function __construct(public Protest $protest) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return $notifiable->email ? ['database', 'mail'] : ['database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your protest was '.$this->protest->status)
            ->greeting('Hello '.($notifiable->name ?? 'Coach').',')
            ->line("Your protest about {$this->protest->event?->name} was **{$this->protest->status}**.")
            ->line($this->protest->resolution ?: '')
            ->line('You can see the full decision in the SportsAxis app.');
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'protest_resolved',
            'title' => 'Protest '.$this->protest->status,
            'body' => "Your protest about {$this->protest->event?->name} was {$this->protest->status}.",
            'url' => '/coach/protests',
            'protestId' => $this->protest->id,
        ];
    }
}
