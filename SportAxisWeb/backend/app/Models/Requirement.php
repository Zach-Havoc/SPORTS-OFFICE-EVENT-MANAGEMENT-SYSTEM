<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Requirement extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'athlete_id', 'athlete_name', 'type', 'name', 'description',
        'file_url', 'status', 'notes', 'reviewed_by', 'reviewed_at', 'submitted_at',
    ];

    protected $casts = [
        'reviewed_at'  => 'datetime',
        'submitted_at' => 'datetime',
    ];
}
