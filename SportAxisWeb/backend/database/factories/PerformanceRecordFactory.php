<?php

namespace Database\Factories;

use App\Models\PerformanceRecord;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<PerformanceRecord> */
class PerformanceRecordFactory extends Factory
{
    protected $model = PerformanceRecord::class;

    public function definition(): array
    {
        return [
            'id'             => (string) Str::uuid(),
            'athlete_id'     => (string) Str::uuid(),
            'athlete_name'   => fake()->name(),
            'event_id'       => null,
            'event_name'     => null,
            'sport'          => 'Basketball',
            'metrics'        => ['points' => 10],
            'overall_rating' => 7,
            'coach_notes'    => fake()->sentence(),
            'recorded_by'    => (string) Str::uuid(),
            'recorded_at'    => now(),
        ];
    }
}
