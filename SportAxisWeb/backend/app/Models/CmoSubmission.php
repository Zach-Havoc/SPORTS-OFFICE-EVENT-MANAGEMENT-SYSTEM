<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A coach's batch of cleared athletes, forwarded to the sports office. */
class CmoSubmission extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'coach_id', 'department', 'sport', 'note', 'submitted_at'];

    protected $casts = ['submitted_at' => 'datetime'];

    public function coach(): BelongsTo
    {
        return $this->belongsTo(User::class, 'coach_id');
    }

    public function athletes(): HasMany
    {
        return $this->hasMany(CmoSubmissionAthlete::class, 'submission_id');
    }
}
