<?php

namespace Database\Factories;

use App\Models\Venue;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Venue> */
class VenueFactory extends Factory
{
    protected $model = Venue::class;

    public function definition(): array
    {
        return [
            'id'         => (string) Str::uuid(),
            'name'       => fake()->company() . ' Gym',
            'type'       => fake()->randomElement(['indoor', 'outdoor', 'open']),
            'capacity'   => fake()->numberBetween(50, 5000),
            'sports'     => ['Basketball', 'Volleyball'],
            'location'   => fake()->address(),
            'facilities' => 'Locker rooms, scoreboard',
            'status'     => 'available',
        ];
    }
}
