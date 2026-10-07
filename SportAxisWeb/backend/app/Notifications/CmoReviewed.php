<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** To the coach: the office accepted, or returned, athletes they forwarded. */
class CmoReviewed extends Notification implements ShouldQueue
{
    use Queueable;

    /** @param  array<int, string>  $athletes */
    public function __construct(public string $status, public array $athletes, public ?string $note = null) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        // A return needs action from the coach, so it goes by email as well.
        return $this->status === 'returned' && $notifiable->email ? ['database', 'mail'] : ['database'];
    }

    private function names(): string
    {
        $shown = array_slice($this->athletes, 0, 5);
        $more = count($this->athletes) - count($shown);

        return implode(', ', $shown).($more > 0 ? " and {$more} more" : '');
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('CMO documents returned')
            ->greeting('Hello '.($notifiable->name ?? 'Coach').',')
            ->line("The sports office returned the CMO documents of: {$this->names()}.")
            ->line($this->note ? "Note from the office: {$this->note}" : '')
            ->action('Open CMO Requirements', rtrim((string) config('app.frontend_url'), '/').'/coach/requirements')
            ->line('Fix what the office asked for, then forward them again.');
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        $accepted = $this->status === 'accepted';

        return [
            'kind' => 'cmo_reviewed',
            'title' => $accepted ? 'CMO documents accepted' : 'CMO documents returned',
            'body' => ($accepted ? 'Accepted by the office: ' : 'Returned by the office: ').$this->names()
                .(! $accepted && $this->note ? ". {$this->note}" : '.'),
            'url' => '/coach/requirements',
        ];
    }
}
