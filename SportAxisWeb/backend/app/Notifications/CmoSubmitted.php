<?php

namespace App\Notifications;

use App\Models\CmoSubmission;
use Illuminate\Notifications\Notification;

/** To the sports office: a coach has forwarded cleared athletes' CMO documents. */
class CmoSubmitted extends Notification
{
    public function __construct(public CmoSubmission $submission) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        $n = (int) ($this->submission->athletes_count ?? $this->submission->athletes()->count());
        $what = trim(($this->submission->sport ? $this->submission->sport.' · ' : '').$this->submission->department);

        return [
            'kind' => 'cmo_submitted',
            'title' => 'CMO documents to review',
            'body' => "{$n} ".($n === 1 ? 'athlete' : 'athletes')." forwarded ({$what}).",
            'url' => '/admin/requirements',
            'submissionId' => $this->submission->id,
        ];
    }
}
