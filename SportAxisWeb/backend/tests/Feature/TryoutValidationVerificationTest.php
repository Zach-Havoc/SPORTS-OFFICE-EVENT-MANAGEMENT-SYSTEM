<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * QA verification pass for the TryoutController::apply() validation
 * hardening. Independent of the developer's tests in TryoutTest.php:
 * targets edge cases around regex anchoring and boundary digit counts.
 */
class TryoutValidationVerificationTest extends TestCase
{
    use RefreshDatabase;

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

    public function test_email_regex_rejects_a_domain_that_merely_contains_batstate_u_as_a_substring(): void
    {
        $this->departments()->create(['name' => 'College of Engineering']);

        $this->postJson('/api/tryouts/apply', $this->applyPayload([
            'email' => 'applicant@notbatstate-u.edu.ph',
        ]))->assertStatus(422)->assertJsonValidationErrors('email');

        $this->assertDatabaseCount('tryout_applications', 0);
    }

    public function test_email_regex_rejects_batstate_u_domain_used_as_a_local_part_trick(): void
    {
        $this->departments()->create(['name' => 'College of Engineering']);

        // Classic bypass attempt: real domain is gmail.com, batstate-u text
        // is stuffed into the local part before the @.
        $this->postJson('/api/tryouts/apply', $this->applyPayload([
            'email' => 'batstate-u.edu.ph@gmail.com',
        ]))->assertStatus(422)->assertJsonValidationErrors('email');

        $this->assertDatabaseCount('tryout_applications', 0);
    }

    public function test_student_id_with_extra_digits_before_the_dash_is_rejected(): void
    {
        $this->departments()->create(['name' => 'College of Engineering']);

        $this->postJson('/api/tryouts/apply', $this->applyPayload(['studentId' => '123-45678']))
            ->assertStatus(422)->assertJsonValidationErrors('studentId');

        $this->assertDatabaseCount('tryout_applications', 0);
    }

    public function test_phone_exactly_10_digits_is_rejected(): void
    {
        $this->departments()->create(['name' => 'College of Engineering']);

        $this->postJson('/api/tryouts/apply', $this->applyPayload(['phone' => '0912345678']))
            ->assertStatus(422)->assertJsonValidationErrors('phone');

        $this->assertDatabaseCount('tryout_applications', 0);
    }

    public function test_phone_exactly_12_digits_is_rejected(): void
    {
        $this->departments()->create(['name' => 'College of Engineering']);

        $this->postJson('/api/tryouts/apply', $this->applyPayload(['phone' => '091234567890']))
            ->assertStatus(422)->assertJsonValidationErrors('phone');

        $this->assertDatabaseCount('tryout_applications', 0);
    }

    public function test_phone_exactly_11_digits_is_accepted(): void
    {
        $this->departments()->create(['name' => 'College of Engineering']);
        $this->emailVerifications()->create([
            'email' => 'applicant@batstate-u.edu.ph', 'code' => '123456',
        ]);

        $this->postJson('/api/tryouts/apply', $this->applyPayload(['phone' => '09123456789']))
            ->assertCreated();
    }

    /**
     * Documents current behavior rather than asserting a "correct" outcome:
     * exists:departments,name relies on the column collation for case
     * sensitivity. This is not a claimed part of the fix, just recording
     * what actually happens today so a false-rejection risk is visible.
     */
    public function test_department_name_case_sensitivity_against_the_exists_rule(): void
    {
        $this->departments()->create(['name' => 'College of Engineering']);
        $this->emailVerifications()->create([
            'email' => 'applicant@batstate-u.edu.ph', 'code' => '123456',
        ]);

        $response = $this->postJson('/api/tryouts/apply', $this->applyPayload([
            'department' => 'college of engineering', // different casing
        ]));

        // Whichever way this goes, log it plainly for the report.
        fwrite(STDERR, "\n[case-sensitivity] lower-case department status: {$response->status()}\n");
        $this->assertContains($response->status(), [201, 422]);
    }
}
