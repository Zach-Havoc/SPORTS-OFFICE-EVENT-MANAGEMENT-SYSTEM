<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One athlete on one game's roster, with their jersey number.
 * See the create_game_players_table migration.
 */
class GamePlayer extends Model
{
    protected $fillable = ['game_id', 'team_id', 'player_id', 'jersey_number', 'rotation_position', 'is_starter'];

    protected $casts = [
        'is_starter' => 'boolean',
        'rotation_position' => 'integer',
    ];

    public function athlete()
    {
        return $this->belongsTo(Athlete::class, 'player_id')->withTrashed();
    }
}
