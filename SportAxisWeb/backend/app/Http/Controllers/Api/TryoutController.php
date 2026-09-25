<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CampusStudent;
use App\Models\EmailVerification;
use App\Models\TryoutApplication;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class TryoutController extends Controller
{
    /** POST /api/tryouts/verify-email (public) */
    public function verifyEmail(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'studentId' => 'required|string|max:20',
            'firstName' => 'nullable|string|max:255',
            'lastName' => 'nullable|string|max:255',
        ]);

        // Check the applicant against the campus roster before mailing a
        // code, so a non-student is told why up front instead of after.
        if ($error = $this->campusMismatch($request)) {
            return response()->json(['message' => $error], 422);
        }

        // Cryptographically secure OTP (rand() is predictable / seedable).
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        EmailVerification::updateOrCreate(
            ['email' => $request->email],
            ['code' => $code, 'expires_at' => now()->addMinutes(15)]
        );

        $mailSent = false;
        try {
            Mail::raw(
                "Dear Athlete,\n\nThank you for applying to the SportsAxis tryouts. Your email verification code is: {$code}\n\nFor your security, this code will expire in 15 minutes. Please enter this code on the application page to proceed.\n\nBest regards,\nThe SportsAxis Team",
                function ($message) use ($request) {
                    $message->to($request->email)
                        ->subject('SportsAxis Tryout Email Verification');
                }
            );
            $mailSent = true;
        } catch (\Exception $e) {
            Log::error('Tryout verification email failed to send: '.$e->getMessage());
        }

        $response = ['message' => 'Verification code sent'];

        // Only ever leak the code back to the client on a local dev machine.
        // Previously this also fired whenever APP_DEBUG was on or the mailer
        // was "log", which completely defeats email verification in any
        // non-production-but-internet-facing environment.
        if (app()->environment('local')) {
            $response['dev_code'] = $code;
        }

        return response()->json($response);
    }

    /** POST /api/tryouts/apply (public) */
    public function apply(Request $request)
    {
        // Normalize before validating: the frontend counts digits only, so a
        // formatted number like "0912-345-6789" must not fail here just
        // because it wasn't stripped of punctuation first.
        $request->merge(['phone' => preg_replace('/\D/', '', (string) $request->phone)]);

        $request->validate([
            'firstName' => 'required|string|max:255',
            'lastName' => 'required|string|max:255',
            'email' => ['required', 'email', 'max:255', 'regex:/@([a-z0-9-]+\.)?batstate-u\.edu\.ph$/i'],
            'studentId' => 'required|string|regex:/^\d{2}-\d{5}$/',
            'department' => 'required|string|max:255|exists:departments,name',
            'phone' => 'required|string|regex:/^\d{11}$/',
            'yearLevel' => 'nullable|string|max:255',
            'sport' => 'nullable|string|max:255',
            'verificationCode' => 'required|string|max:10',
        ]);

        // Re-checked here: the code only proves the email is theirs, and this
        // endpoint is public, so it can't trust that verify-email ran first.
        if ($error = $this->campusMismatch($request)) {
            return response()->json(['message' => $error], 422);
        }

        // Validate verification code
        $verification = EmailVerification::where('email', $request->email)->first();

        if (! $verification || (string) $verification->code !== (string) trim($request->verificationCode)) {
            return response()->json(['message' => 'Invalid verification code.'], 422);
        }

        if ($verification->expires_at && $verification->expires_at->isPast()) {
            return response()->json(['message' => 'Verification code has expired. Please request a new code.'], 422);
        }

        // Code is valid - consume it
        $verification->delete();

        $app = TryoutApplication::create([
            'id' => Str::uuid(),
            'announcement_id' => $request->announcementId,
            'sport' => $request->sport,
            'coach_id' => $request->coachId,
            'first_name' => $request->firstName,
            'last_name' => $request->lastName,
            'email' => $request->email,
            'student_id' => $request->studentId,
            'department' => $request->department,
            'phone' => $request->phone,
            'year_level' => $request->yearLevel ?? '1st Year',
            'applied_at' => now(),
        ]);

        return response()->json($app, 201);
    }

    /**
     * Why this applicant isn't a verified campus student, or null if they are.
     * The SR Code must be on the registrar roster (Settings → Students), and
     * the email must be the one on record for it. Rows imported without an
     * email fall back to matching the applicant's name instead.
     */
    private function campusMismatch(Request $request): ?string
    {
        $student = CampusStudent::find(CampusStudent::normalizeCode($request->studentId));

        if (! $student) {
            return "We couldn't find that SR Code in the campus student list. Check it with your college registrar.";
        }

        if ($student->email) {
            return strcasecmp(trim($student->email), trim((string) $request->email)) === 0
                ? null
                : 'That email is not the school email on record for this SR Code.';
        }

        return $student->nameMatches("{$request->firstName} {$request->lastName}")
            ? null
            : 'The name you entered does not match the registrar record for that SR Code.';
    }

    /** GET /api/tryouts (authenticated coach/admin) */
    public function index(Request $request)
    {
        $user = $request->user();

        $query = TryoutApplication::query()->orderByDesc('applied_at');
        if ($user->role === 'coach') {
            $query->where('coach_id', $user->id);
        }

        return response()->json($query->get());
    }
}
