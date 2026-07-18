<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Venue extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'name', 'type', 'capacity', 'sports', 'location',
        'facilities', 'status', 'created_by',
    ];

    protected $casts = [
        'sports'   => 'array',
        'capacity' => 'integer',
    ];
}
