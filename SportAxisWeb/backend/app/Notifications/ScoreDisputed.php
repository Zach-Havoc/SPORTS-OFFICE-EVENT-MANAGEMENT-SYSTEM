<?php

namespace App\Notifications;

use App\Models\Score;
use Illuminate\Notifications\Notification;

/** To the sports office: a score was set aside pending review. */
class ScoreDisputed extends Notification
{
    public function __construct(public Score $score, public string $eventName) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'score_disputed',
            'title' => 'Score disputed',
            'body' => "{$this->score->department}'s score in {$this->eventName} is on hold: {$this->score->dispute_reason}",
            'url' => '/admin/reports',
            'scoreId' => $this->score->id,
            'eventId' => $this->score->event_id,
        ];
    }
}
