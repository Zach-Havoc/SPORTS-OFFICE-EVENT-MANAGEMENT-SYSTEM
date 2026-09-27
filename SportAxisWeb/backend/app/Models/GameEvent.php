<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * One play in a basketball game (a basket, a free throw or a foul).
 * See the create_game_events_table migration. Undo soft-deletes it.
 */
class GameEvent extends Model
{
    use SoftDeletes;

    public const TYPES = ['FG2', 'FG3', 'FT', 'FOUL'];

    protected $fillable = ['game_id', 'team_id', 'player_id', 'type', 'period', 'game_clock', 'recorded_by'];

    protected $casts = [
        'period' => 'integer',
    ];

    /** Points this play is worth, from config/sportaxis.php. */
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
