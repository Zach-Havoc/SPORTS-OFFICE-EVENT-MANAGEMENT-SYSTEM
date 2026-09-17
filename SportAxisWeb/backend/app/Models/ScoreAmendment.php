<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One after-the-fact edit to a score. Append-only; never updated. */
class ScoreAmendment extends Model
{
    public const UPDATED_AT = null;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'score_id', 'amended_by',
        'old_scores', 'new_scores', 'old_total', 'new_total', 'reason',
    ];

    protected $casts = [
        'old_scores' => 'array',
        'new_scores' => 'array',
        'old_total' => 'decimal:4',
        'new_total' => 'decimal:4',
        'created_at' => 'datetime',
    ];

    public function score(): BelongsTo
    {
        return $this->belongsTo(Score::class, 'score_id');
    }

    public function amender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'amended_by');
    }

    public function toApiFormat(): array
    {
        return [
            'id' => $this->id,
            'scoreId' => $this->score_id,
            'amendedBy' => $this->amended_by,
            'amenderName' => $this->relationLoaded('amender') ? $this->amender?->name : null,
            'oldScores' => $this->old_scores,
            'newScores' => $this->new_scores,
            'oldTotal' => $this->old_total,
            'newTotal' => $this->new_total,
            'reason' => $this->reason,
            'createdAt' => $this->created_at,
        ];
    }
}
