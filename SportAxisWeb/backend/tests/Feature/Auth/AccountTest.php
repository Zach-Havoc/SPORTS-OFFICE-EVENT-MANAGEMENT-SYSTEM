<?php

namespace Tests\Feature\Auth;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Authenticated account endpoints:
 *   GET  /api/user
 *   POST /api/logout
 *   PUT  /api/account/profile
 *   PUT  /api/account/password
 */
class AccountTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_endpoint_requires_authentication(): void
    {
        $this->getJson('/api/user')->assertUnauthorized();
    }

    public function test_user_endpoint_returns_the_current_user_without_the_password(): void
    {
        $this->actingAsRole('coach', ['email' => 'me@example.com']);

        $res = $this->getJson('/api/user')->assertOk()->assertJsonPath('email', 'me@example.com');

        $this->assertArrayNotHasKey('password', $res->json());
    }

    public function test_profile_name_can_be_updated(): void
    {
        $user = $this->actingAsRole('athlete', ['name' => 'Old Name']);

        $this->putJson('/api/account/profile', ['name' => 'New Name'])
            ->assertOk()
            ->assertJsonPath('user.name', 'New Name');

        $this->assertSame('New Name', $user->fresh()->name);
    }

    public function test_profile_update_rejects_empty_name(): void
    {
        $this->actingAsRole('athlete');

        $this->putJson('/api/account/profile', ['name' => ''])
            ->assertStatus(422)
            ->assertJsonValidationErrors('name');
    }

    public function test_password_change_requires_the_correct_current_password(): void
    {
        $this->actingAsRole('athlete', ['password' => Hash::make('current-pw-123')]);

        $this->putJson('/api/account/password', [
            'currentPassword' => 'wrong',
            'newPassword'     => 'brand-new-pw',
        ])->assertStatus(400)->assertJsonFragment(['error' => 'Current password is incorrect']);
    }

    public function test_password_change_succeeds_with_the_correct_current_password(): void
    {
        $user = $this->actingAsRole('athlete', ['password' => Hash::make('current-pw-123')]);

        $this->putJson('/api/account/password', [
            'currentPassword' => 'current-pw-123',
            'newPassword'     => 'brand-new-pw',
        ])->assertOk();

        $this->assertTrue(Hash::check('brand-new-pw', $user->fresh()->password));
    }

    public function test_new_password_must_be_at_least_8_chars(): void
    {
        $this->actingAsRole('athlete', ['password' => Hash::make('current-pw-123')]);

        $this->putJson('/api/account/password', [
            'currentPassword' => 'current-pw-123',
            'newPassword'     => 'short',
        ])->assertStatus(422)->assertJsonValidationErrors('newPassword');
    }

    public function test_logout_revokes_the_current_token(): void
    {
        // Use a real token (not Sanctum::actingAs) so we can assert it is deleted.
        $user  = $this->users()->create();
        $token = $user->createToken('t')->plainTextToken;

        $this->withToken($token)->postJson('/api/logout')->assertOk();

        $this->assertCount(0, $user->fresh()->tokens()->get());
    }
}
