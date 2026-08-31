<?php

namespace Database\Factories;

use App\Models\Score;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Score> */
class ScoreFactory extends Factory
{
    protected $model = Score::class;

    public function definition(): array
    {
        return [
            'id'               => (string) Str::uuid(),
            'event_id'         => (string) Str::uuid(),
            'department'       => 'College of Engineering',
            'judge_id'         => (string) Str::uuid(),
            'judge_name'       => fake()->name(),
            'scores'           => ['Technical' => 8, 'Teamwork' => 7],
            'total_score'      => 80,
            'submitted_via_qr' => false,
            'method'           => 'manual',
            'image_url'        => null,
        ];
    }
}
