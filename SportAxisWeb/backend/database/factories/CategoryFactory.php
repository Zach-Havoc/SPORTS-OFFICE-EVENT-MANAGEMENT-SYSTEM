<?php

namespace Database\Factories;

use App\Models\Category;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Category> */
class CategoryFactory extends Factory
{
    protected $model = Category::class;

    public function definition(): array
    {
        return [
            'id'          => (string) Str::uuid(),
            'name'        => fake()->unique()->randomElement(['Basketball', 'Volleyball', 'Badminton', 'Football', 'Swimming', 'Chess']),
            'description' => fake()->sentence(),
        ];
    }
}
