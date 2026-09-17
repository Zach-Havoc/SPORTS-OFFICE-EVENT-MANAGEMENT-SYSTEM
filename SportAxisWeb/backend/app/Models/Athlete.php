<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Athlete extends Model
{
    use Auditable;
    use SoftDeletes;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'user_id', 'student_id', 'first_name', 'last_name', 'email',
        'department', 'year_level', 'course', 'coach_id', 'sport',
        'status', 'emergency_contact', 'enrolled_via_code', 'enrolled_at', 'category_id',
    ];

    protected $casts = [
        'emergency_contact' => 'array',
        'enrolled_via_code' => 'boolean',
        'enrolled_at' => 'datetime',
    ];

    /**
     * The athlete's own login account, when they have one. While it's set the
     * account owns the athlete's name and email.
     */
    public function account()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** The sport this athlete is rostered for, by key. */
    public function categoryRow()
    {
        return $this->belongsTo(Category::class, 'category_id');
    }
}
