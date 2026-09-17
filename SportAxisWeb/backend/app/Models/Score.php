<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Score extends Model
{
    use Auditable;
    use SoftDeletes;

    /** Statuses that count toward the leaderboard. */
    public const COUNTING_STATUSES = ['verified', 'official'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'event_id', 'department', 'judge_id', 'judge_name',
        'scores', 'total_score', 'submitted_via_qr', 'method', 'image_url',
        'status', 'dispute_reason', 'verified_by', 'verified_at',
    ];

    protected $casts = [
        'scores' => 'array',
        'submitted_via_qr' => 'boolean',
        'total_score' => 'decimal:4',
        'verified_at' => 'datetime',
    ];

    public function event()
    {
        return $this->belongsTo(Event::class, 'event_id');
    }

    public function amendments(): HasMany
    {
        return $this->hasMany(ScoreAmendment::class, 'score_id')->latest('created_at');
    }
}
