<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A college's formal complaint about an event outcome. Opened by a coach,
 * resolved (upheld or dismissed, with a written resolution) by the sports
 * office.
 */
class Protest extends Model
{
    use Auditable;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'event_id', 'season_id', 'filed_by', 'department',
        'reason', 'status', 'resolution', 'resolved_by', 'resolved_at',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
    ];

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class, 'event_id');
    }

    public function filer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'filed_by');
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function toApiFormat(): array
    {
        $event = $this->relationLoaded('event') ? $this->event : null;

        return [
            'id' => $this->id,
            'eventId' => $this->event_id,
            'eventName' => $event?->name,
            'eventCategory' => $event?->category,
            'seasonId' => $this->season_id,
            'filedBy' => $this->filed_by,
            'filerName' => $this->relationLoaded('filer') ? $this->filer?->name : null,
            'department' => $this->department,
            'reason' => $this->reason,
            'status' => $this->status,
            'resolution' => $this->resolution,
            'resolvedBy' => $this->resolved_by,
            'resolverName' => $this->relationLoaded('resolver') ? $this->resolver?->name : null,
            'resolvedAt' => $this->resolved_at,
            'createdAt' => $this->created_at,
        ];
    }
}
