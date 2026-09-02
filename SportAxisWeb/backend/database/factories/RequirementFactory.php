<?php

namespace Database\Factories;

use App\Models\Requirement;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Requirement> */
class RequirementFactory extends Factory
{
    protected $model = Requirement::class;

    public function definition(): array
    {
        return [
            'id'           => (string) Str::uuid(),
            'athlete_id'   => (string) Str::uuid(),
            'athlete_name' => fake()->name(),
            'type'         => 'waiver',
            'name'         => 'Signed Waiver',
            'description'  => fake()->sentence(),
            'file_url'     => '/storage/requirements/' . Str::uuid() . '.pdf',
            'status'       => 'pending',
            'notes'        => null,
            'reviewed_by'  => null,
            'reviewed_at'  => null,
            'submitted_at' => now(),
        ];
    }
}
