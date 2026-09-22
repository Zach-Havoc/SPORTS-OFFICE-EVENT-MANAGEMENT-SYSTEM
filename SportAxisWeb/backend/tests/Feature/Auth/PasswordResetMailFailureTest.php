<?php

namespace Tests\Feature\Auth;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * AuthController::resetPassword (POST /api/reset-password) overwrites the
 * account's password with a random temporary one BEFORE it tries to email
 * that temporary password to the user:
 *
 *   $user->update(['password' => Hash::make($tempPassword)]);
 *   try {
 *       Mail::raw(...);
 *   } catch (\Exception $e) {
 *       return response()->json(['error' => 'Failed to send email...'], 500);
 *   }
 *
 * If the mail send throws (SMTP misconfigured/down — a routine ops issue,
 * not a rare edge case), the account is left with a password nobody knows:
 * the old password no longer works, and the new temporary one was never
 * delivered. The account is locked out with no recovery path until an admin
 * intervenes directly in the database.
 *
 * This is a genuine, currently-uncovered defect in
 * app/Http/Controllers/Api/AuthController.php (resetPassword). Not fixed
 * here — this test only proves it.
 */
class PasswordResetMailFailureTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_failed_reset_email_does_not_leave_the_account_permanently_locked_out(): void
    {
        $user = $this->users()->create([
            'email' => 'victim@example.com',
            'password' => Hash::make('original-password'),
        ]);

        Mail::shouldReceive('raw')->once()->andThrow(new \RuntimeException('Connection could not be established with host smtp.gmail.com'));

        $this->postJson('/api/reset-password', ['email' => 'victim@example.com'])
            ->assertStatus(500);

        $fresh = $user->fresh();

        // BUG (currently fails): the controller already overwrote the
        // password with an unknown temporary one before the mail attempt,
        // so neither the original password nor any password the user could
        // know still works — the account is locked out with no recovery.
        $this->assertTrue(
            Hash::check('original-password', $fresh->password),
            'Expected the original password to still work after a failed reset email, '
            .'but AuthController::resetPassword rotates the password before attempting '
            .'to send it, so a mail failure locks the account out with no way back in.'
        );
    }
}
