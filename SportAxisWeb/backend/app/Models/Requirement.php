<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Requirement extends Model
{
    use Auditable;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'athlete_id', 'athlete_name', 'type', 'requirement_type_id', 'supersedes_id',
        'name', 'description', 'file_url', 'status', 'notes', 'reviewed_by', 'reviewed_at', 'submitted_at',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
        'submitted_at' => 'datetime',
    ];

    /** The catalog entry this submission is meant to satisfy, if any. */
    public function requirementType(): BelongsTo
    {
        return $this->belongsTo(RequirementType::class, 'requirement_type_id');
    }

    /** The earlier (usually rejected) submission this one replaces. */
    public function supersedes(): BelongsTo
    {
        return $this->belongsTo(self::class, 'supersedes_id');
    }
}
