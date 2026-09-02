<?php

namespace Tests\Feature\Auth;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * POST /api/reset-password
 *
 * This endpoint immediately issues a temporary password, so it must not leak
 * which emails exist and must not let an attacker repeatedly reset a victim's
 * password. Verifies the generic response, the 15-minute per-account cooldown
 * (security fix) and the throttle.
 */
class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_unknown_email_gets_the_same_generic_response(): void
    {
        $this->postJson('/api/reset-password', ['email' => 'nobody@example.com'])
            ->assertOk()
            ->assertJsonFragment(['message' => 'If that email exists, a reset link has been sent.'])
            ->assertJsonMissing(['error' => true]);
    }

    public function test_known_email_gets_a_new_temporary_password(): void
    {
        $user = $this->users()->create([
            'email'    => 'victim@example.com',
            'password' => Hash::make('original-password'),
        ]);
        $originalHash = $user->password;

        $this->postJson('/api/reset-password', ['email' => 'victim@example.com'])
            ->assertOk()
            ->assertJsonFragment(['message' => 'If that email exists, a reset link has been sent.']);

        // Password was rotated; the old one no longer works.
        $newHash = $user->fresh()->password;
        $this->assertNotSame($originalHash, $newHash);
        $this->assertFalse(Hash::check('original-password', $newHash));
    }

    public function test_second_reset_within_the_cooldown_does_not_rotate_again(): void
    {
        $user = $this->users()->create(['email' => 'victim@example.com']);

        $this->postJson('/api/reset-password', ['email' => 'victim@example.com'])->assertOk();
        $hashAfterFirst = $user->fresh()->password;

        // Immediate second attempt — still 200 (generic), but the password is
        // NOT changed again, so an attacker can't repeatedly lock the account.
        $this->postJson('/api/reset-password', ['email' => 'victim@example.com'])->assertOk();
        $this->assertSame($hashAfterFirst, $user->fresh()->password);
    }

    public function test_missing_email_is_rejected(): void
    {
        $this->postJson('/api/reset-password', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_reset_password_is_rate_limited(): void
    {
        $this->users()->create(['email' => 'victim@example.com']);

        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/reset-password', ['email' => "spam{$i}@example.com"])->assertOk();
        }

        $this->postJson('/api/reset-password', ['email' => 'spam-final@example.com'])
            ->assertStatus(429);
    }
}
