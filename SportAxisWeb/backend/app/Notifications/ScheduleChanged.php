<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * A schedule someone is part of was created, moved, postponed or cancelled —
 * a game, a training session or a tryout. One class for all three so the
 * in-app list and the email read the same way whatever changed.
 */
class ScheduleChanged extends Notification
{
    /**
     * @param  'scheduled'|'rescheduled'|'postponed'|'venue_changed'|'cancelled'  $change
     * @param  array<int, string>  $details  one line each: what, when, where, what changed
     */
    public function __construct(
        public string $change,
        public string $title,
        public array $details,
        public ?string $url = null,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        // Tryout applicants have no account: they're reached by email only.
        if ($notifiable instanceof \Illuminate\Notifications\AnonymousNotifiable) {
            return ['mail'];
        }

        return ! empty($notifiable->email) ? ['database', 'mail'] : ['database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->subject($this->title)
            ->greeting('Hello'.(isset($notifiable->name) ? ' '.$notifiable->name : '').',');

        foreach ($this->details as $line) {
            $mail->line($line);
        }

        return $this->url
            ? $mail->action('Open SportsAxis', rtrim((string) config('app.frontend_url'), '/').$this->url)
            : $mail;
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'schedule_changed',
            'change' => $this->change,
            'title' => $this->title,
            'body' => implode(' · ', $this->details),
            'url' => $this->url,
        ];
    }
}
