<?php

namespace Tests\Feature;

use App\Models\EmailVerification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
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

    protected function setUp(): void
    {
        parent::setUp();

        // The applicant every payload below uses, on the registrar roster.
        $this->campusStudents()->create([
            'sr_code' => '24-00001', 'first_name' => 'Sam', 'last_name' => 'Cruz',
            'email' => 'applicant@batstate-u.edu.ph',
        ]);
    }

    private function verifyPayload(array $overrides = []): array
    {
        return array_merge([
            'email' => 'applicant@batstate-u.edu.ph',
            'studentId' => '24-00001',
            'firstName' => 'Sam',
            'lastName' => 'Cruz',
        ], $overrides);
    }

    public function test_verify_email_issues_a_six_digit_code(): void
    {
        $this->postJson('/api/tryouts/verify-email', $this->verifyPayload())
            ->assertOk()
            ->assertJsonFragment(['message' => 'Verification code sent'])
            // dev_code is only exposed when APP_ENV=local (tests run as 'testing').
            ->assertJsonMissingPath('dev_code');

        $row = EmailVerification::where('email', 'applicant@batstate-u.edu.ph')->first();
        $this->assertNotNull($row);
        $this->assertMatchesRegularExpression('/^\d{6}$/', $row->code);
        $this->assertTrue($row->expires_at->isFuture());
    }

    public function test_verify_email_exposes_dev_code_only_in_local_env(): void
    {
        config(['app.env' => 'local']);
        $this->app['env'] = 'local';

        $this->postJson('/api/tryouts/verify-email', $this->verifyPayload())
            ->assertOk()
            ->assertJsonStructure(['message', 'dev_code']);
    }

    public function test_verify_email_validates_the_address(): void
    {
        $this->postJson('/api/tryouts/verify-email', $this->verifyPayload(['email' => 'not-an-email']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_verify_email_is_rate_limited(): void
    {
        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/tryouts/verify-email', $this->verifyPayload())->assertOk();
        }

        $this->postJson('/api/tryouts/verify-email', $this->verifyPayload())
            ->assertStatus(429);
    }

    private function applyPayload(array $overrides = []): array
    {
        return array_merge([
            'firstName' => 'Sam',
            'lastName' => 'Cruz',
            'email' => 'applicant@batstate-u.edu.ph',
            'studentId' => '24-00001',
            'department' => 'College of Engineering',
            'phone' => '09123456789',
            'verificationCode' => '123456',
        ], $overrides);
    }

    public function test_apply_succeeds_with_a_valid_code_and_consumes_it(): void
    {
        $this->departments()->create(['name' => 'College of Engineering']);
        $this->emailVerifications()->create([
            'email' => 'applicant@batstate-u.edu.ph', 'code' => '123456',
        ]);

        $this->postJson('/api/tryouts/apply', $this->applyPayload())
            ->assertCreated();

        $this->assertDatabaseHas('tryout_applications', [
            'email' => 'applicant@batstate-u.edu.ph',
            'student_id' => '24-00001',
        ]);
        // The verification code is single-use.
        $this->assertDatabaseMissing('email_verifications', ['email' => 'applicant@batstate-u.edu.ph']);
    }

    public function test_apply_accepts_a_subdomain_of_batstate_u_and_a_formatted_phone_number(): void
    {
        \App\Models\CampusStudent::whereKey('24-00001')->update(['email' => 'applicant@students.batstate-u.edu.ph']);
        $this->departments()->create(['name' => 'College of Engineering']);
        $this->emailVerifications()->create([
            'email' => 'applicant@students.batstate-u.edu.ph', 'code' => '123456',
        ]);

        $this->postJson('/api/tryouts/apply', $this->applyPayload([
            'email' => 'applicant@students.batstate-u.edu.ph',
            // Punctuation is stripped server-side before the digit-count check.
            'phone' => '0912-345-6789',
        ]))->assertCreated();

        $this->assertDatabaseHas('tryout_applications', [
            'email' => 'applicant@students.batstate-u.edu.ph',
            'phone' => '09123456789',
        ]);
    }

    public function test_apply_rejects_a_non_batstate_u_email(): void
    {
        $this->departments()->create(['name' => 'College of Engineering']);

        $this->postJson('/api/tryouts/apply', $this->applyPayload(['email' => 'applicant@gmail.com']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');

        $this->assertDatabaseCount('tryout_applications', 0);
    }

    public function test_apply_rejects_a_malformed_student_id(): void
    {
        $this->departments()->create(['name' => 'College of Engineering']);

        $this->postJson('/api/tryouts/apply', $this->applyPayload(['studentId' => '2024-1']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('studentId');

        $this->assertDatabaseCount('tryout_applications', 0);
    }

    public function test_apply_rejects_a_phone_number_with_the_wrong_digit_count(): void
    {
        $this->departments()->create(['name' => 'College of Engineering']);

        $this->postJson('/api/tryouts/apply', $this->applyPayload(['phone' => '091234567']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('phone');

        $this->assertDatabaseCount('tryout_applications', 0);
    }

    public function test_apply_rejects_an_unknown_department(): void
    {
        $this->postJson('/api/tryouts/apply', $this->applyPayload(['department' => 'Not A Real College']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('department');

        $this->assertDatabaseCount('tryout_applications', 0);
    }

    public function test_apply_rejects_a_wrong_code(): void
    {
        $this->departments()->create(['name' => 'College of Engineering']);
        $this->emailVerifications()->create(['email' => 'applicant@batstate-u.edu.ph', 'code' => '111111']);

        $this->postJson('/api/tryouts/apply', $this->applyPayload(['verificationCode' => '999999']))
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'Invalid verification code.']);

        $this->assertDatabaseCount('tryout_applications', 0);
    }

    public function test_apply_rejects_an_expired_code(): void
    {
        $this->departments()->create(['name' => 'College of Engineering']);
        $this->emailVerifications()->expired()->create([
            'email' => 'applicant@batstate-u.edu.ph', 'code' => '123456',
        ]);

        $this->postJson('/api/tryouts/apply', $this->applyPayload())
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'Verification code has expired. Please request a new code.']);
    }

    public function test_apply_rejects_when_no_code_was_ever_requested(): void
    {
        $this->departments()->create(['name' => 'College of Engineering']);

        $this->postJson('/api/tryouts/apply', $this->applyPayload())
            ->assertStatus(422);
    }

    public function test_apply_validates_required_fields(): void
    {
        $this->postJson('/api/tryouts/apply', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['firstName', 'lastName', 'email', 'studentId', 'department', 'phone', 'verificationCode']);
    }

    // ── Campus roster check ────────────────────────────────────────────

    public function test_no_code_is_sent_for_an_sr_code_not_on_the_campus_roster(): void
    {
        Mail::fake();

        $this->postJson('/api/tryouts/verify-email', $this->verifyPayload(['studentId' => '99-99999']))
            ->assertStatus(422)
            ->assertJsonFragment(['message' => "We couldn't find that SR Code in the campus student list. Check it with your college registrar."]);

        $this->assertDatabaseCount('email_verifications', 0);
    }

    public function test_no_code_is_sent_when_the_email_is_not_the_one_on_record(): void
    {
        $this->postJson('/api/tryouts/verify-email', $this->verifyPayload(['email' => 'someone.else@batstate-u.edu.ph']))
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'That email is not the school email on record for this SR Code.']);

        $this->assertDatabaseCount('email_verifications', 0);
    }

    public function test_the_email_on_record_is_matched_case_insensitively(): void
    {
        $this->postJson('/api/tryouts/verify-email', $this->verifyPayload(['email' => 'Applicant@BatState-U.edu.ph']))
            ->assertOk();
    }

    public function test_a_roster_row_without_an_email_is_matched_on_name_instead(): void
    {
        $this->campusStudents()->create([
            'sr_code' => '24-00002', 'first_name' => 'Ana', 'last_name' => 'Reyes', 'email' => null,
        ]);
        $payload = ['studentId' => '24-00002', 'email' => 'ana@batstate-u.edu.ph'];

        $this->postJson('/api/tryouts/verify-email', $this->verifyPayload($payload + ['firstName' => 'Ana', 'lastName' => 'Reyes']))
            ->assertOk();
        $this->postJson('/api/tryouts/verify-email', $this->verifyPayload($payload + ['firstName' => 'Someone', 'lastName' => 'Else']))
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'The name you entered does not match the registrar record for that SR Code.']);
    }

    public function test_apply_rechecks_the_roster_even_with_a_valid_code(): void
    {
        $this->departments()->create(['name' => 'College of Engineering']);
        // A valid code for an address that isn't this SR Code's email on record.
        $this->emailVerifications()->create([
            'email' => 'intruder@batstate-u.edu.ph', 'code' => '123456',
            'expires_at' => now()->addMinutes(10),
        ]);

        $this->postJson('/api/tryouts/apply', $this->applyPayload(['email' => 'intruder@batstate-u.edu.ph']))
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'That email is not the school email on record for this SR Code.']);

        $this->assertDatabaseCount('tryout_applications', 0);
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
