<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Builds valid `users` rows for the SportsAxis schema.
 *
 * NOTE: this schema has NO `email_verified_at` / `remember_token` columns, so
 * (unlike the stock Laravel factory) we must not set them.
 *
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected $model = User::class;

    /** Shared bcrypt hash so tests can log in with the literal password "password". */
    public static ?string $password = null;

    public function definition(): array
    {
        return [
            'id'       => (string) Str::uuid(),
            'name'     => fake()->name(),
            'email'    => fake()->unique()->safeEmail(),
            'password' => static::$password ??= Hash::make('password'),
            'role'     => 'athlete',
        ];
    }

    public function admin(): static
    {
        return $this->state(fn () => ['role' => 'admin']);
    }

    public function coach(): static
    {
        return $this->state(fn () => [
            'role'            => 'coach',
            'sport'           => 'Basketball',
            'sports'          => ['Basketball'],
            'department'      => 'College of Engineering',
            'gender_category' => 'Men',
            'enrollment_code' => strtoupper(Str::random(8)),
        ]);
    }

    public function athlete(): static
    {
        return $this->state(fn () => ['role' => 'athlete']);
    }

    public function judge(): static
    {
        return $this->state(fn () => ['role' => 'judge']);
    }
}
