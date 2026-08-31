<?php

namespace Database\Factories;

use App\Models\RegistrationCode;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<RegistrationCode> */
class RegistrationCodeFactory extends Factory
{
    protected $model = RegistrationCode::class;

    public function definition(): array
    {
        return [
            'code'       => strtoupper(Str::random(8)),
            'role'       => 'athlete',
            'label'      => 'Test code',
            'used'       => false,
            'used_by'    => null,
            'created_by' => null,
            'used_at'    => null,
            'expires_at' => null,
        ];
    }

    public function role(string $role): static
    {
        return $this->state(fn () => ['role' => $role]);
    }

    public function used(): static
    {
        return $this->state(fn () => ['used' => true, 'used_at' => now()]);
    }

    public function expired(): static
    {
        return $this->state(fn () => ['expires_at' => now()->subDay()]);
    }
}
