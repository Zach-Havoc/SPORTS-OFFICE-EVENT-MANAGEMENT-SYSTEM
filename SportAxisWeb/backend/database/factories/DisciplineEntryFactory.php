<?php

namespace Database\Factories;

use App\Models\DisciplineEntry;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<DisciplineEntry> */
class DisciplineEntryFactory extends Factory
{
    protected $model = DisciplineEntry::class;

    public function definition(): array
    {
        return [
            'id' => (string) Str::uuid(),
            'category' => 'Badminton — M Singles A',
            'department' => 'College of Engineering',
            'athlete_id' => (string) Str::uuid(),
            'athlete_name' => fake()->name(),
            'coach_id' => UserFactory::new()->coach()->create()->id,
            'pair_slot' => null,
        ];
    }
}
