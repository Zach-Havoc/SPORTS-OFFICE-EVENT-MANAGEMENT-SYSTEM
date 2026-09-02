<?php

namespace Database\Factories;

use App\Models\Event;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Event> */
class EventFactory extends Factory
{
    protected $model = Event::class;

    public function definition(): array
    {
        return [
            'id'          => (string) Str::uuid(),
            'name'        => fake()->sentence(3),
            'category'    => 'Basketball',
            'schedule'    => now()->addDays(fake()->numberBetween(1, 30))->toDateString(),
            'start_time'  => '09:00',
            'end_time'    => '11:00',
            'venue_id'    => null,
            'venue_name'  => 'Main Gym',
            'departments' => ['College of Engineering', 'College of Business'],
            'judges'      => [],
            'criteria'    => [],
            'status'      => 'upcoming',
            'qr_token'    => Str::random(32),
        ];
    }

    public function ongoing(): static
    {
        return $this->state(fn () => ['status' => 'ongoing']);
    }

    public function completed(): static
    {
        return $this->state(fn () => ['status' => 'completed']);
    }
}
