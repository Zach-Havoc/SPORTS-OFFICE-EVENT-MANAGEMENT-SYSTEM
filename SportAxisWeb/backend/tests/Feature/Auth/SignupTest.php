<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * POST /api/signup
 *
 * A new account can only be created with a valid, unused, role-matching
 * registration code. Verifies the happy path plus every rejection branch.
 */
class SignupTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'email'            => 'newuser@example.com',
            'password'         => 'secret123',
            'name'             => 'New User',
            'role'             => 'athlete',
            'registrationCode' => 'CODE1234',
        ], $overrides);
    }

    public function test_signup_succeeds_with_a_valid_unused_code(): void
    {
        $this->regCodes()->create(['code' => 'CODE1234', 'role' => 'athlete', 'used' => false]);

        $res = $this->postJson('/api/signup', $this->payload());

        $res->assertCreated()
            ->assertJsonStructure(['token', 'user' => ['id', 'email', 'role']])
            ->assertJsonPath('user.role', 'athlete');

        // Account persisted, password hashed (never stored in clear).
        $user = User::where('email', 'newuser@example.com')->first();
        $this->assertNotNull($user);
        $this->assertNotSame('secret123', $user->password);

        // The code is now consumed.
        $this->assertDatabaseHas('registration_codes', [
            'code'    => 'CODE1234',
            'used'    => true,
            'used_by' => $user->id,
        ]);
    }

    public function test_password_shorter_than_8_chars_is_rejected(): void
    {
        $this->regCodes()->create(['code' => 'CODE1234', 'role' => 'athlete']);

        $this->postJson('/api/signup', $this->payload(['password' => 'short']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('password');
    }

    public function test_duplicate_email_is_rejected(): void
    {
        $this->regCodes()->create(['code' => 'CODE1234', 'role' => 'athlete']);
        $this->users()->create(['email' => 'taken@example.com']);

        $this->postJson('/api/signup', $this->payload(['email' => 'taken@example.com']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_invalid_role_value_is_rejected(): void
    {
        $this->regCodes()->create(['code' => 'CODE1234', 'role' => 'athlete']);

        $this->postJson('/api/signup', $this->payload(['role' => 'superadmin']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('role');
    }

    public function test_missing_required_fields_are_rejected(): void
    {
        $this->postJson('/api/signup', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'password', 'name', 'role', 'registrationCode']);
    }

    public function test_unknown_code_is_rejected(): void
    {
        $this->postJson('/api/signup', $this->payload(['registrationCode' => 'DOESNOTEXIST']))
            ->assertStatus(400)
            ->assertJsonFragment(['error' => 'Invalid or expired registration code']);
    }

    public function test_code_for_a_different_role_cannot_be_used_to_escalate(): void
    {
        // An athlete code must not create an admin account.
        $this->regCodes()->create(['code' => 'ATHCODE', 'role' => 'athlete', 'used' => false]);

        $this->postJson('/api/signup', $this->payload([
            'role'             => 'admin',
            'registrationCode' => 'ATHCODE',
        ]))->assertStatus(400);

        $this->assertDatabaseMissing('users', ['email' => 'newuser@example.com']);
    }

    public function test_already_used_code_is_rejected(): void
    {
        $this->regCodes()->used()->create(['code' => 'USEDCODE', 'role' => 'athlete']);

        $this->postJson('/api/signup', $this->payload(['registrationCode' => 'USEDCODE']))
            ->assertStatus(400);
    }

    public function test_expired_code_is_rejected(): void
    {
        $this->regCodes()->expired()->create(['code' => 'OLDCODE', 'role' => 'athlete', 'used' => false]);

        $this->postJson('/api/signup', $this->payload(['registrationCode' => 'OLDCODE']))
            ->assertStatus(400)
            ->assertJsonFragment(['error' => 'Registration code has expired']);
    }

    public function test_client_supplied_id_is_ignored_mass_assignment(): void
    {
        $this->regCodes()->create(['code' => 'CODE1234', 'role' => 'athlete']);

        $this->postJson('/api/signup', $this->payload(['id' => 'attacker-chosen-id']))
            ->assertCreated();

        // Server generates the UUID; the attacker's value is not used.
        $this->assertDatabaseMissing('users', ['id' => 'attacker-chosen-id']);
        $this->assertDatabaseHas('users', ['email' => 'newuser@example.com', 'role' => 'athlete']);
    }
}
