<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'email', 'password', 'name', 'role',
        'sport', 'enrollment_code', 'coach_id', 'coach_name', 'enrolled_at',
    ];

    protected $hidden = ['password'];

    protected $casts = [
        'enrolled_at' => 'datetime',
    ];

    public function toApiFormat(): array
    {
        return [
            'id'             => $this->id,
            'email'          => $this->email,
            'name'           => $this->name,
            'role'           => $this->role,
            'sport'          => $this->sport,
            'enrollmentCode' => $this->enrollment_code,
            'coachId'        => $this->coach_id,
            'coachName'      => $this->coach_name,
            'enrolledAt'     => $this->enrolled_at,
        ];
    }
}
