<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use Auditable;
    use HasApiTokens;
    use Notifiable;

    /** The account row keeps hard deletes; RESTRICT foreign keys guard it. */
    protected $auditExclude = ['enrollment_code'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'email', 'password', 'name', 'role', 'active',
        'sport', 'sports', 'gender_category', 'department', 'enrollment_code', 'coach_id', 'coach_name', 'enrolled_at',
        'sr_code', 'gender', 'student_verified_at', 'department_id',
        'year_level', 'course', 'phone', 'emergency_contact',
    ];

    protected $hidden = ['password'];

    protected $casts = [
        'enrolled_at' => 'datetime',
        'student_verified_at' => 'datetime',
        'sports' => 'array',
        'emergency_contact' => 'array',
        'active' => 'boolean',
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
            'id' => $this->id,
            'email' => $this->email,
            'name' => $this->name,
            'role' => $this->role,
            'active' => $this->active ?? true,
            'sport' => $this->sport,
            'sports' => $this->sportsList(),
            'department' => $this->department,
            'genderCategory' => $this->gender_category,
            'srCode' => $this->sr_code,
            'gender' => $this->gender,
            'studentVerifiedAt' => $this->student_verified_at,
            'yearLevel' => $this->year_level,
            'course' => $this->course,
            'phone' => $this->phone,
            'emergencyContact' => $this->emergency_contact,
            'enrollmentCode' => $this->enrollment_code,
            'coachId' => $this->coach_id,
            'coachName' => $this->coach_name,
            'enrolledAt' => $this->enrolled_at,
        ];
    }

    /** The athlete's or coach's college, by key. */
    public function departmentRow()
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    protected static function booted(): void
    {
        // Keep the coach's sport keys in step with the `sports` name list, so
        // no write path (admin form, coach profile, seeder) can forget to.
        static::saved(fn (User $user) => $user->syncSportKeys());
    }

    /** The sports this coach handles, by key. */
    public function sportCategories()
    {
        return $this->belongsToMany(Category::class, 'coach_category', 'coach_id', 'category_id');
    }

    /** Mirror `sports` / `sport` (names) onto the `coach_category` junction. */
    public function syncSportKeys(): void
    {
        if ($this->role !== 'coach') {
            return;
        }

        if (! $this->wasRecentlyCreated && ! $this->wasChanged('sports') && ! $this->wasChanged('sport')
            && DB::table('coach_category')->where('coach_id', $this->id)->exists()) {
            return;
        }

        $wanted = collect($this->sportsList())
            ->map(fn ($n) => mb_strtolower(trim((string) $n)))
            ->filter()
            ->unique();

        $ids = $wanted->isEmpty()
            ? collect()
            : Category::all(['id', 'name'])
                ->filter(fn ($c) => $wanted->contains(mb_strtolower(trim($c->name))))
                ->pluck('id');

        DB::table('coach_category')->where('coach_id', $this->id)->delete();

        if ($ids->isNotEmpty()) {
            DB::table('coach_category')->insertOrIgnore(
                $ids->map(fn ($id) => ['coach_id' => $this->id, 'category_id' => $id])->all()
            );
        }
    }
}
