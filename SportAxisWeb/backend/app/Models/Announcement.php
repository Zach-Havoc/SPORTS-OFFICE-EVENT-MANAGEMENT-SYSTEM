<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Announcement extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['id', 'title', 'content', 'sport', 'coach_id', 'coach_name', 'is_tryout'];

    protected $casts = [
        'is_tryout' => 'boolean',
    ];
}
