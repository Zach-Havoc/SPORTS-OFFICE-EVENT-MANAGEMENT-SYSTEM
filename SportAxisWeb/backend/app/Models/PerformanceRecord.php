<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PerformanceRecord extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'athlete_id', 'athlete_name', 'event_id', 'event_name',
        'sport', 'metrics', 'overall_rating', 'coach_notes', 'recorded_by', 'recorded_at',
    ];

    protected $casts = [
        'metrics'     => 'array',
        'recorded_at' => 'datetime',
    ];
}
