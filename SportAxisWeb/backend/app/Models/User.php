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
        'sport', 'sports', 'gender_category', 'department', 'enrollment_code', 'coach_id', 'coach_name', 'enrolled_at',
    ];

    protected $hidden = ['password'];

    protected $casts = [
        'enrolled_at' => 'datetime',
        'sports'      => 'array',
    ];

    /**
     * The coach's full list of sports. Falls back to the single `sport` string
     * for coaches created before multi-sport support.
     *
     * @return array<int, string>
     */
    public function sportsList(): array
    {
        if (is_array($this->sports) && count($this->sports) > 0) {
            return array_values($this->sports);
        }

        return $this->sport ? [$this->sport] : [];
    }

    public function toApiFormat(): array
    {
        return [
            'id'             => $this->id,
            'email'          => $this->email,
            'name'           => $this->name,
            'role'           => $this->role,
            'sport'          => $this->sport,
            'sports'         => $this->sportsList(),
            'department'     => $this->department,
            'genderCategory' => $this->gender_category,
            'enrollmentCode' => $this->enrollment_code,
            'coachId'        => $this->coach_id,
            'coachName'      => $this->coach_name,
            'enrolledAt'     => $this->enrolled_at,
        ];
    }
}
