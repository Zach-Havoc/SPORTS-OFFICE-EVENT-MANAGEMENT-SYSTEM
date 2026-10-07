<?php

namespace App\Notifications;

use App\Models\Protest;
use Illuminate\Notifications\Notification;

/** To the sports office: the other team has filed its counter. */
class ProtestCounterFiled extends Notification
{
    public function __construct(public Protest $protest) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'protest_counter_filed',
            'title' => 'Counter filed',
            'body' => "{$this->protest->counter_department} filed its counter to the protest about {$this->protest->event?->name}. Ready for a decision.",
            'url' => '/admin/protests',
            'protestId' => $this->protest->id,
        ];
    }
}
