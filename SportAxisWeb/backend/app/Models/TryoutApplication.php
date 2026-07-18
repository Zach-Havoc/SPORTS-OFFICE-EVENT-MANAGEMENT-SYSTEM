<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TryoutApplication extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'announcement_id', 'sport', 'coach_id',
        'first_name', 'last_name', 'email', 'student_id',
        'department', 'phone', 'year_level', 'status', 'applied_at',
    ];

    protected $casts = [
        'applied_at' => 'datetime',
    ];
}
