<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;

class TryoutApplication extends Model
{
    use Auditable;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'announcement_id', 'sport', 'coach_id',
        'first_name', 'last_name', 'email', 'student_id',
        'department', 'phone', 'year_level', 'status', 'applied_at',
        'reviewed_by', 'reviewed_at', 'review_note',
    ];

    protected $casts = [
        'applied_at' => 'datetime',
        'reviewed_at' => 'datetime',
    ];
}
