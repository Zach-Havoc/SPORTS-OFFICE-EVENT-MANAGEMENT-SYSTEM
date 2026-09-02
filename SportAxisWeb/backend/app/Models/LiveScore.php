<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * The live, in-progress score of a game. One row per event.
 * See the create_live_scores_table migration for the field contract.
 */
class LiveScore extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'event_id', 'sport', 'home_team', 'away_team',
        'home_score', 'away_score', 'period', 'detail', 'status',
        'version', 'updated_by', 'started_at', 'finalized_at',
    ];

    protected $casts = [
        'detail'       => 'array',
        'home_score'   => 'integer',
        'away_score'   => 'integer',
        'version'      => 'integer',
        'started_at'   => 'datetime',
        'finalized_at' => 'datetime',
    ];

    public function event()
    {
        return $this->belongsTo(Event::class, 'event_id');
    }

    /** @param  Event|null  $event  optional, to enrich the payload with event metadata */
    public function toApiFormat(?Event $event = null): array
    {
        $event ??= $this->relationLoaded('event') ? $this->event : null;

        return [
            'eventId'     => $this->event_id,
            'sport'       => $this->sport,
            'homeTeam'    => $this->home_team,
            'awayTeam'    => $this->away_team,
            'homeScore'   => (int) $this->home_score,
            'awayScore'   => (int) $this->away_score,
            'period'      => $this->period,
            'detail'      => $this->detail ?? [],
            'status'      => $this->status,
            'version'     => (int) $this->version,
            'updatedBy'   => $this->updated_by,
            'startedAt'   => $this->started_at,
            'finalizedAt' => $this->finalized_at,
            'updatedAt'   => $this->updated_at,
            'eventName'   => $event?->name,
            'venueName'   => $event?->venue_name,
            'category'    => $event?->category,
        ];
    }
}
