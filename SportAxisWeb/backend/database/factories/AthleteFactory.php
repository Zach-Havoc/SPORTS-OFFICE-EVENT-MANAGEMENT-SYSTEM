<?php

namespace Database\Factories;

use App\Models\Athlete;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Athlete> */
class AthleteFactory extends Factory
{
    protected $model = Athlete::class;

    public function definition(): array
    {
        return [
            'id'                => (string) Str::uuid(),
            'student_id'        => fake()->unique()->numerify('##-#####'),
            'first_name'        => fake()->firstName(),
            'last_name'         => fake()->lastName(),
            'email'             => fake()->unique()->safeEmail(),
            'department'        => 'College of Engineering',
            'year_level'        => '1st Year',
            'course'            => 'BS Engineering',
            'coach_id'          => null,
            'sport'             => 'Basketball',
            'status'            => 'active',
            'emergency_contact' => ['name' => 'Jane Doe', 'relationship' => 'Parent', 'phone' => '09171234567'],
            'enrolled_via_code' => false,
        ];
    }
}
