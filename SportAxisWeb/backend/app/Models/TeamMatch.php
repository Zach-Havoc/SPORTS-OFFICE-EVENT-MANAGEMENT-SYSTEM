<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A single head-to-head result between two departments in a sport.
 * (Named TeamMatch, not Match — `match` is a reserved word in PHP.)
 */
class TeamMatch extends Model
{
    protected $table = 'team_matches';

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'sport', 'stage', 'event_id',
        'home_team', 'away_team', 'home_score', 'away_score',
        'winner', 'is_draw', 'status', 'played_at', 'recorded_by',
    ];

    protected $casts = [
        'home_score' => 'decimal:2',
        'away_score' => 'decimal:2',
        'is_draw'    => 'boolean',
        'played_at'  => 'datetime',
    ];

    public function event()
    {
        return $this->belongsTo(Event::class, 'event_id');
    }

    /**
     * Decide the winner from the two scores. `null` winner + is_draw=true on a tie.
     */
    public function resolveOutcome(): void
    {
        if ($this->home_score === null || $this->away_score === null) {
            $this->winner = null;
            $this->is_draw = false;

            return;
        }

        $home = (float) $this->home_score;
        $away = (float) $this->away_score;

        if (abs($home - $away) < 0.0001) {
            $this->winner = null;
            $this->is_draw = true;
        } else {
            $this->winner = $home > $away ? $this->home_team : $this->away_team;
            $this->is_draw = false;
        }
    }
}
