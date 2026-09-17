<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One athlete assigned by their coach to a racquet line for their college.
 * Supplies the bracket display label ("Santos (CET)"); the bracket engine
 * itself still tracks the college as the team.
 */
class DisciplineEntry extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'category', 'department', 'athlete_id', 'athlete_name', 'coach_id', 'pair_slot',
    ];
}
