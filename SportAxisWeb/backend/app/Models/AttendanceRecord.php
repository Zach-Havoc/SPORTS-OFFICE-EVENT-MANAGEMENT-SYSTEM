<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AttendanceRecord extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'athlete_id', 'event_id', 'date', 'status', 'notes', 'recorded_by', 'recorded_at',
    ];

    protected $casts = [
        'recorded_at' => 'datetime',
    ];
}
