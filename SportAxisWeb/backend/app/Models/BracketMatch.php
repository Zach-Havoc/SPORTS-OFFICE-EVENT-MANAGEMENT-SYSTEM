<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A node in a bracket tree. (Named BracketMatch, not Match — `match` is a
 * reserved word in PHP.)
 */
class BracketMatch extends Model
{
    protected $table = 'bracket_matches';

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'bracket_id', 'round', 'slot', 'stage_label',
        'home_team', 'away_team',
        'home_source_match_id', 'away_source_match_id',
        'home_source_outcome', 'away_source_outcome',
        'next_match_id', 'next_match_slot',
        'scheduled_date', 'scheduled_time', 'venue_id', 'venue_name',
        'event_id', 'winner', 'loser', 'is_bye', 'status',
    ];

    protected $casts = [
        'round'  => 'integer',
        'slot'   => 'integer',
        'is_bye' => 'boolean',
    ];

    public function bracket()
    {
        return $this->belongsTo(Bracket::class);
    }

    public function event()
    {
        return $this->belongsTo(Event::class, 'event_id');
    }

    /** Both teams known and the match has not been decided yet. */
    public function bothTeamsKnown(): bool
    {
        return $this->home_team !== null && $this->away_team !== null;
    }

    public function toApiFormat(): array
    {
        return [
            'id'                => $this->id,
            'round'             => $this->round,
            'slot'              => $this->slot,
            'stageLabel'        => $this->stage_label,
            'homeTeam'          => $this->home_team,
            'awayTeam'          => $this->away_team,
            'homeSourceMatchId' => $this->home_source_match_id,
            'awaySourceMatchId' => $this->away_source_match_id,
            'nextMatchId'       => $this->next_match_id,
            'nextMatchSlot'     => $this->next_match_slot,
            'scheduledDate'     => $this->scheduled_date,
            'scheduledTime'     => $this->scheduled_time,
            'venueId'           => $this->venue_id,
            'venueName'         => $this->venue_name,
            'eventId'           => $this->event_id,
            'winner'            => $this->winner,
            'loser'             => $this->loser,
            'isBye'             => $this->is_bye,
            'status'            => $this->status,
        ];
    }
}
