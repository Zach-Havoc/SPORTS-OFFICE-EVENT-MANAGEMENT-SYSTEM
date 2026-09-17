<?php

namespace Database\Factories;

use App\Models\AttendanceRecord;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<AttendanceRecord> */
class AttendanceRecordFactory extends Factory
{
    protected $model = AttendanceRecord::class;

    public function definition(): array
    {
        return [
            'id' => (string) Str::uuid(),
            'athlete_id' => (string) Str::uuid(),
            'event_id' => 'training',
            'date' => now()->toDateString(),
            'status' => 'present',
            'notes' => null,
            'recorded_by' => UserFactory::new()->coach()->create()->id,
            'recorded_at' => now(),
        ];
    }
}
