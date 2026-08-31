<?php

namespace Database\Factories;

use App\Models\EmailVerification;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<EmailVerification> */
class EmailVerificationFactory extends Factory
{
    protected $model = EmailVerification::class;

    public function definition(): array
    {
        return [
            'email'      => fake()->unique()->safeEmail(),
            'code'       => str_pad((string) fake()->numberBetween(0, 999999), 6, '0', STR_PAD_LEFT),
            'expires_at' => now()->addMinutes(15),
        ];
    }

    public function expired(): static
    {
        return $this->state(fn () => ['expires_at' => now()->subMinute()]);
    }
}
