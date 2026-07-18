<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Athlete extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'student_id', 'first_name', 'last_name', 'email',
        'department', 'year_level', 'course', 'coach_id', 'sport',
        'status', 'emergency_contact', 'enrolled_via_code', 'enrolled_at',
    ];

    protected $casts = [
        'emergency_contact' => 'array',
        'enrolled_via_code' => 'boolean',
        'enrolled_at'       => 'datetime',
    ];
}
