<?php

namespace App\Notifications;

use App\Models\Requirement;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** To the athlete: a coach or the office reviewed one of their documents. */
class RequirementReviewed extends Notification
{
    public function __construct(public Requirement $requirement) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return $notifiable->email ? ['database', 'mail'] : ['database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $verb = $this->requirement->status === 'approved' ? 'approved' : 'returned';

        return (new MailMessage)
            ->subject("Your requirement was {$verb}")
            ->greeting('Hello '.($notifiable->name ?? 'Athlete').',')
            ->line("\"{$this->requirement->name}\" was **{$this->requirement->status}**.")
            ->when($this->requirement->notes, fn ($m) => $m->line('Note: '.$this->requirement->notes))
            ->line('Open the app to see the details.');
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'requirement_reviewed',
            'title' => 'Requirement '.$this->requirement->status,
            'body' => "\"{$this->requirement->name}\" was {$this->requirement->status}.",
            'url' => '/athlete/requirements',
            'requirementId' => $this->requirement->id,
        ];
    }
}
