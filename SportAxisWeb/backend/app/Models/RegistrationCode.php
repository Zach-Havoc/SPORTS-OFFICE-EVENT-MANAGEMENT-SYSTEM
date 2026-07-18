<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RegistrationCode extends Model
{
    protected $primaryKey = 'code';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'code', 'role', 'label', 'used', 'used_by', 'created_by', 'used_at', 'expires_at',
    ];

    protected $casts = [
        'used'       => 'boolean',
        'used_at'    => 'datetime',
        'expires_at' => 'datetime',
    ];
}
