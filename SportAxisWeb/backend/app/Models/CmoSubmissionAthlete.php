<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One athlete in a CMO submission, and the office's decision on them. */
class CmoSubmissionAthlete extends Model
{
    protected $fillable = [
        'submission_id', 'athlete_id', 'athlete_name', 'department', 'sport', 'division',
        'status', 'office_note', 'reviewed_by', 'reviewed_at',
    ];

    protected $casts = ['reviewed_at' => 'datetime'];

    public function submission(): BelongsTo
    {
        return $this->belongsTo(CmoSubmission::class, 'submission_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function toApiFormat(): array
    {
        $sub = $this->relationLoaded('submission') ? $this->submission : null;

        return [
            'id' => $this->id,
            'submissionId' => $this->submission_id,
            'athleteId' => $this->athlete_id,
            'athleteName' => $this->athlete_name,
            'department' => $this->department,
            'sport' => $this->sport,
            'division' => $this->division,
            'status' => $this->status,
            'officeNote' => $this->office_note,
            'reviewerName' => $this->relationLoaded('reviewer') ? $this->reviewer?->name : null,
            'reviewedAt' => $this->reviewed_at,
            'coachName' => $sub && $sub->relationLoaded('coach') ? $sub->coach?->name : null,
            'coachNote' => $sub?->note,
            'submittedAt' => $sub?->submitted_at,
        ];
    }
}
