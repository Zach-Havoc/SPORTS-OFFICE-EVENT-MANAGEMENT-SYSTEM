<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * One play in a play-by-play game: a basket, free throw or foul in
 * basketball; a rally point, timeout, substitution or set start in
 * volleyball. See the create_game_events_table migration. Undo soft-deletes it.
 */
class GameEvent extends Model
{
    use SoftDeletes;

    public const TYPES = ['FG2', 'FG3', 'FT', 'FOUL'];

    /** Rally points — the scoring team wins the rally. */
    public const VOLLEYBALL_POINTS = ['KILL', 'ACE', 'BLOCK', 'OPP_ERROR'];

    public const VOLLEYBALL_TYPES = [...self::VOLLEYBALL_POINTS, 'TIMEOUT', 'SUB', 'SET_START'];

    protected $fillable = ['game_id', 'team_id', 'player_id', 'player_out_id', 'type', 'period', 'game_clock', 'detail', 'recorded_by'];

    protected $casts = [
        'period' => 'integer',
        'detail' => 'array',
    ];

    /** Points a basketball play is worth, from config/sportaxis.php. */
    public static function pointsFor(string $type): int
    {
        return (int) config("sportaxis.basketball.points.$type", 0);
    }

    public function points(): int
    {
        return self::pointsFor($this->type);
    }

    public function isFoul(): bool
    {
        return $this->type === 'FOUL';
    }
}
