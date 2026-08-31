<?php

namespace Tests\Feature;

use App\Models\EmailVerification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Public tryout flow:
 *   POST /api/tryouts/verify-email   (throttle 6/min; emails a 6-digit code)
 *   POST /api/tryouts/apply          (throttle 6/min; consumes the code once)
 *   GET  /api/tryouts                (admin/coach; coach sees only own)
 */
class TryoutTest extends TestCase
{
    use RefreshDatabase;

    public function test_verify_email_issues_a_six_digit_code(): void
    {
        $this->postJson('/api/tryouts/verify-email', ['email' => 'applicant@example.com'])
            ->assertOk()
            ->assertJsonFragment(['message' => 'Verification code sent'])
            // dev_code is only exposed when APP_ENV=local (tests run as 'testing').
            ->assertJsonMissingPath('dev_code');

        $row = EmailVerification::where('email', 'applicant@example.com')->first();
        $this->assertNotNull($row);
        $this->assertMatchesRegularExpression('/^\d{6}$/', $row->code);
        $this->assertTrue($row->expires_at->isFuture());
    }

    public function test_verify_email_exposes_dev_code_only_in_local_env(): void
    {
        config(['app.env' => 'local']);
        $this->app['env'] = 'local';

        $this->postJson('/api/tryouts/verify-email', ['email' => 'local@example.com'])
            ->assertOk()
            ->assertJsonStructure(['message', 'dev_code']);
    }

    public function test_verify_email_validates_the_address(): void
    {
        $this->postJson('/api/tryouts/verify-email', ['email' => 'not-an-email'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_verify_email_is_rate_limited(): void
    {
        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/tryouts/verify-email', ['email' => "a{$i}@example.com"])->assertOk();
        }

        $this->postJson('/api/tryouts/verify-email', ['email' => 'over@example.com'])
            ->assertStatus(429);
    }

    private function applyPayload(array $overrides = []): array
    {
        return array_merge([
            'firstName'        => 'Sam',
            'lastName'         => 'Cruz',
            'email'            => 'applicant@example.com',
            'studentId'        => '24-00001',
            'department'       => 'College of Engineering',
            'phone'            => '09123456789',
            'verificationCode' => '123456',
        ], $overrides);
    }

    public function test_apply_succeeds_with_a_valid_code_and_consumes_it(): void
    {
        $this->emailVerifications()->create([
            'email' => 'applicant@example.com', 'code' => '123456',
        ]);

        $this->postJson('/api/tryouts/apply', $this->applyPayload())
            ->assertCreated();

        $this->assertDatabaseHas('tryout_applications', [
            'email'      => 'applicant@example.com',
            'student_id' => '24-00001',
        ]);
        // The verification code is single-use.
        $this->assertDatabaseMissing('email_verifications', ['email' => 'applicant@example.com']);
    }

    public function test_apply_rejects_a_wrong_code(): void
    {
        $this->emailVerifications()->create(['email' => 'applicant@example.com', 'code' => '111111']);

        $this->postJson('/api/tryouts/apply', $this->applyPayload(['verificationCode' => '999999']))
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'Invalid verification code.']);

        $this->assertDatabaseCount('tryout_applications', 0);
    }

    public function test_apply_rejects_an_expired_code(): void
    {
        $this->emailVerifications()->expired()->create([
            'email' => 'applicant@example.com', 'code' => '123456',
        ]);

        $this->postJson('/api/tryouts/apply', $this->applyPayload())
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'Verification code has expired. Please request a new code.']);
    }

    public function test_apply_rejects_when_no_code_was_ever_requested(): void
    {
        $this->postJson('/api/tryouts/apply', $this->applyPayload())
            ->assertStatus(422);
    }

    public function test_apply_validates_required_fields(): void
    {
        $this->postJson('/api/tryouts/apply', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['firstName', 'lastName', 'email', 'studentId', 'department', 'phone', 'verificationCode']);
    }

    public function test_tryouts_listing_requires_admin_or_coach(): void
    {
        $this->getJson('/api/tryouts')->assertUnauthorized();

        $this->actingAsRole('athlete');
        $this->getJson('/api/tryouts')->assertForbidden();
    }

    public function test_coach_only_sees_their_own_applications_admin_sees_all(): void
    {
        $coach = $this->users()->coach()->create();
        $this->tryouts()->create(['coach_id' => $coach->id, 'first_name' => 'Mine']);
        $this->tryouts()->create(['coach_id' => null, 'first_name' => 'Someone Elses']);

        $this->loginAs($coach);
        $this->getJson('/api/tryouts')
            ->assertOk()
            ->assertJsonFragment(['first_name' => 'Mine'])
            ->assertJsonMissing(['first_name' => 'Someone Elses']);

        $this->actingAsRole('admin');
        $this->getJson('/api/tryouts')
            ->assertOk()
            ->assertJsonFragment(['first_name' => 'Mine'])
            ->assertJsonFragment(['first_name' => 'Someone Elses']);
    }
}
