<?php

namespace Database\Factories;

use App\Models\TryoutApplication;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<TryoutApplication> */
class TryoutApplicationFactory extends Factory
{
    protected $model = TryoutApplication::class;

    public function definition(): array
    {
        return [
            'id'              => (string) Str::uuid(),
            'announcement_id' => null,
            'sport'           => 'Basketball',
            'coach_id'        => null,
            'first_name'      => fake()->firstName(),
            'last_name'       => fake()->lastName(),
            'email'           => fake()->unique()->safeEmail(),
            'student_id'      => fake()->numerify('##-#####'),
            'department'      => 'College of Engineering',
            'phone'           => fake()->numerify('###########'),
            'year_level'      => '1st Year',
            'status'          => 'pending',
            'applied_at'      => now(),
        ];
    }
}
