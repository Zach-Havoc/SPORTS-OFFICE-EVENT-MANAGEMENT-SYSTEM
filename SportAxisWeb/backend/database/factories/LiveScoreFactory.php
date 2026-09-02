<?php

namespace Database\Factories;

use App\Models\LiveScore;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<LiveScore> */
class LiveScoreFactory extends Factory
{
    protected $model = LiveScore::class;

    public function definition(): array
    {
        return [
            'id'         => (string) Str::uuid(),
            'event_id'   => (string) Str::uuid(),
            'sport'      => 'Basketball',
            'home_team'  => 'College of Engineering',
            'away_team'  => 'College of Business',
            'home_score' => fake()->numberBetween(0, 90),
            'away_score' => fake()->numberBetween(0, 90),
            'period'     => 'Q2',
            'detail'     => [],
            'status'     => 'in_progress',
            'version'    => 1,
            'started_at' => now(),
        ];
    }

    public function inProgress(): static
    {
        return $this->state(fn () => ['status' => 'in_progress', 'started_at' => now()]);
    }

    public function final(): static
    {
        return $this->state(fn () => ['status' => 'final', 'finalized_at' => now()]);
    }
}
