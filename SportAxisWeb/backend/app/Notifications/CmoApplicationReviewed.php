<?php

namespace App\Notifications;

use App\Models\CmoApplication;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** To the athlete: the Sports Office reviewed their CMO application. */
class CmoApplicationReviewed extends Notification
{
    public function __construct(public CmoApplication $application) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return $notifiable->email ? ['database', 'mail'] : ['database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $verb = $this->application->status === 'approved' ? 'approved' : 'returned';

        return (new MailMessage)
            ->subject("Your CMO application was {$verb}")
            ->greeting('Hello '.($notifiable->name ?? 'Athlete').',')
            ->line("Your application \"{$this->application->reference_no}\" ({$this->application->purpose}) was **{$this->application->status}**.")
            ->when($this->application->notes, fn ($m) => $m->line('Note: '.$this->application->notes))
            ->line('Open the app to see the details.');
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'cmo_application_reviewed',
            'title' => 'CMO Application '.$this->application->status,
            'body' => "\"{$this->application->reference_no}\" ({$this->application->purpose}) was {$this->application->status}.",
            'url' => '/athlete/cmo-applications',
            'cmoApplicationId' => $this->application->id,
        ];
    }
}
