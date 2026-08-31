<?php

namespace Database\Factories;

use App\Models\Announcement;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Announcement> */
class AnnouncementFactory extends Factory
{
    protected $model = Announcement::class;

    public function definition(): array
    {
        return [
            'id'         => (string) Str::uuid(),
            'title'      => fake()->sentence(4),
            'content'    => fake()->paragraph(),
            'sport'      => 'Basketball',
            'coach_id'   => (string) Str::uuid(),
            'coach_name' => fake()->name(),
            'is_tryout'  => true,
        ];
    }
}
