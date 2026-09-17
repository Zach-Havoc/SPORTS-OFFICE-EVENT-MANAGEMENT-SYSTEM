<?php

namespace Database\Factories;

use App\Models\CampusStudent;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<CampusStudent> */
class CampusStudentFactory extends Factory
{
    protected $model = CampusStudent::class;

    public function definition(): array
    {
        return [
            'sr_code' => fake()->unique()->numerify('##-#####'),
            'first_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
            'middle_name' => fake()->optional()->lastName(),
            'gender' => fake()->randomElement(['Male', 'Female']),
            'college' => 'College of Engineering',
            'program' => 'BS Engineering',
            'year_level' => fake()->randomElement(['1st Year', '2nd Year', '3rd Year', '4th Year']),
            'email' => fake()->unique()->safeEmail(),
        ];
    }
}
