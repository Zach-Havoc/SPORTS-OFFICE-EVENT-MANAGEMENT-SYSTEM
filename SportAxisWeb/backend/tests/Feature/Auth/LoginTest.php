<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * POST /api/login
 *
 * Covers credential checking, token issuance, single-session behaviour
 * (old tokens revoked on new login) and the 10-requests/minute throttle.
 */
class LoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_with_correct_credentials_returns_a_token(): void
    {
        $this->users()->create([
            'email'    => 'user@example.com',
            'password' => Hash::make('correct-horse'),
            'role'     => 'coach',
        ]);

        $this->postJson('/api/login', ['email' => 'user@example.com', 'password' => 'correct-horse'])
            ->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'email', 'role']])
            ->assertJsonPath('user.role', 'coach');
    }

    public function test_login_with_wrong_password_is_rejected(): void
    {
        $this->users()->create([
            'email'    => 'user@example.com',
            'password' => Hash::make('correct-horse'),
        ]);

        $this->postJson('/api/login', ['email' => 'user@example.com', 'password' => 'wrong'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email'); // controller throws ValidationException on 'email'
    }

    public function test_login_for_unknown_email_is_rejected(): void
    {
        $this->postJson('/api/login', ['email' => 'ghost@example.com', 'password' => 'whatever'])
            ->assertStatus(422);
    }

    public function test_missing_fields_are_rejected(): void
    {
        $this->postJson('/api/login', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'password']);
    }

    public function test_logging_in_again_revokes_previous_tokens(): void
    {
        $user = $this->users()->create([
            'email'    => 'user@example.com',
            'password' => Hash::make('pw12345678'),
        ]);
        $user->createToken('old');
        $this->assertCount(1, $user->tokens()->get());

        $this->postJson('/api/login', ['email' => 'user@example.com', 'password' => 'pw12345678'])
            ->assertOk();

        // Exactly one active token remains: the fresh one.
        $this->assertCount(1, $user->fresh()->tokens()->get());
    }

    public function test_login_is_rate_limited_to_10_attempts_per_minute(): void
    {
        $this->users()->create([
            'email'    => 'user@example.com',
            'password' => Hash::make('pw12345678'),
        ]);

        // 10 allowed (wrong password → 422), the 11th is throttled → 429.
        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/login', ['email' => 'user@example.com', 'password' => 'nope'])
                ->assertStatus(422);
        }

        $this->postJson('/api/login', ['email' => 'user@example.com', 'password' => 'nope'])
            ->assertStatus(429);
    }
}
