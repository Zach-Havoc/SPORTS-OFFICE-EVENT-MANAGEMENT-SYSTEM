<?php

namespace Database\Factories;

use App\Models\AttendanceSession;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<AttendanceSession> */
class AttendanceSessionFactory extends Factory
{
    protected $model = AttendanceSession::class;

    public function definition(): array
    {
        $coachId = UserFactory::new()->coach()->create()->id;

        return [
            'id' => (string) Str::uuid(),
            'coach_id' => $coachId,
            'title' => 'Training session',
            'date' => now()->toDateString(),
            'created_by' => $coachId,
        ];
    }
}
