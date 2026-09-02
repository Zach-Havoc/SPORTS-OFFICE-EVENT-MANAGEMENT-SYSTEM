<?php

namespace Tests\Feature;

use App\Models\RegistrationCode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Admin-only registration code management:
 *   GET    /api/registration-codes
 *   POST   /api/registration-codes
 *   DELETE /api/registration-codes/{code}
 */
class RegistrationCodeTest extends TestCase
{
    use RefreshDatabase;

    public function test_endpoints_require_an_admin(): void
    {
        $this->getJson('/api/registration-codes')->assertUnauthorized();

        $this->actingAsRole('coach');
        $this->getJson('/api/registration-codes')->assertForbidden();
        $this->postJson('/api/registration-codes', ['role' => 'judge'])->assertForbidden();
    }

    public function test_admin_can_generate_a_code(): void
    {
        $admin = $this->actingAsRole('admin');

        $res = $this->postJson('/api/registration-codes', [
            'role'  => 'judge',
            'label' => 'Judge batch 1',
        ])->assertCreated();

        $code = $res->json('code'); // model is returned directly
        $this->assertDatabaseHas('registration_codes', [
            'code'       => $code,
            'role'       => 'judge',
            'used'       => false,
            'created_by' => $admin->id,
        ]);
    }

    public function test_generated_code_can_carry_an_expiry(): void
    {
        $this->actingAsRole('admin');

        $res = $this->postJson('/api/registration-codes', [
            'role'          => 'coach',
            'expiresInDays' => 7,
        ])->assertCreated();

        $this->assertNotNull(
            RegistrationCode::where('code', $res->json('code'))->first()->expires_at
        );
    }

    public function test_role_is_validated(): void
    {
        $this->actingAsRole('admin');

        $this->postJson('/api/registration-codes', ['role' => 'wizard'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('role');
    }

    public function test_expires_in_days_must_be_a_positive_integer(): void
    {
        $this->actingAsRole('admin');

        $this->postJson('/api/registration-codes', ['role' => 'coach', 'expiresInDays' => 0])
            ->assertStatus(422)
            ->assertJsonValidationErrors('expiresInDays');
    }

    public function test_admin_can_revoke_a_code(): void
    {
        $this->actingAsRole('admin');
        $this->regCodes()->create(['code' => 'REVOKEME', 'role' => 'athlete']);

        $this->deleteJson('/api/registration-codes/REVOKEME')->assertOk();
        $this->assertDatabaseMissing('registration_codes', ['code' => 'REVOKEME']);
    }

    public function test_revoking_an_unknown_code_returns_404(): void
    {
        $this->actingAsRole('admin');

        $this->deleteJson('/api/registration-codes/NOPE')->assertNotFound();
    }
}
