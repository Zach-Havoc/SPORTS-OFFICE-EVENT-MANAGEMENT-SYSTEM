<?php

namespace App\Notifications;

use App\Models\Protest;
use Illuminate\Notifications\Notification;

/** To the sports office: a coach has filed a protest. */
class ProtestFiled extends Notification
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
            'kind' => 'protest_filed',
            'title' => 'New protest',
            'body' => "{$this->protest->department} protested {$this->protest->event?->name}.",
            'url' => '/admin/protests',
            'protestId' => $this->protest->id,
        ];
    }
}
