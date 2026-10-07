<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A college's formal complaint about an event outcome.
 *
 *   1. A coach files it within 12 hours after the game, with the formal
 *      protest form (PDF).
 *   2. The office decides it, or first asks the other team for a counter
 *      (status `awaiting_counter`); that team has 12 hours to file its
 *      counter statement and form (PDF).
 *   3. The office upholds or dismisses it, with a written resolution.
 */
class Protest extends Model
{
    use Auditable;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'event_id', 'season_id', 'filed_by', 'department',
        'reason', 'form_url', 'status', 'resolution', 'resolved_by', 'resolved_at',
        'counter_department', 'counter_requested_by', 'counter_requested_at', 'counter_due_at',
        'counter_reason', 'counter_form_url', 'counter_filed_by', 'counter_filed_at',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
        'counter_requested_at' => 'datetime',
        'counter_due_at' => 'datetime',
        'counter_filed_at' => 'datetime',
    ];

    public static function windowHours(): int
    {
        return (int) config('sportaxis.protest_window_hours', 12);
    }

    /** The other team was asked for a counter and its 12 hours ran out without one. */
    public function counterLapsed(): bool
    {
        return $this->status === 'awaiting_counter' && $this->counter_due_at && $this->counter_due_at->isPast();
    }

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

    public function counterFiler(): BelongsTo
    {
        return $this->belongsTo(User::class, 'counter_filed_by');
    }

    public function toApiFormat(): array
    {
        $event = $this->relationLoaded('event') ? $this->event : null;

        return [
            'id' => $this->id,
            'eventId' => $this->event_id,
            'eventName' => $event?->name,
            'eventCategory' => $event?->category,
            'eventDepartments' => $event?->departments ?? [],
            'seasonId' => $this->season_id,
            'filedBy' => $this->filed_by,
            'filerName' => $this->relationLoaded('filer') ? $this->filer?->name : null,
            'department' => $this->department,
            'reason' => $this->reason,
            'formUrl' => $this->form_url,
            'status' => $this->status,
            'counterDepartment' => $this->counter_department,
            'counterRequestedAt' => $this->counter_requested_at,
            'counterDueAt' => $this->counter_due_at,
            'counterLapsed' => $this->counterLapsed(),
            'counterReason' => $this->counter_reason,
            'counterFormUrl' => $this->counter_form_url,
            'counterFiledAt' => $this->counter_filed_at,
            'counterFilerName' => $this->relationLoaded('counterFiler') ? $this->counterFiler?->name : null,
            'resolution' => $this->resolution,
            'resolvedBy' => $this->resolved_by,
            'resolverName' => $this->relationLoaded('resolver') ? $this->resolver?->name : null,
            'resolvedAt' => $this->resolved_at,
            'createdAt' => $this->created_at,
        ];
    }
}
