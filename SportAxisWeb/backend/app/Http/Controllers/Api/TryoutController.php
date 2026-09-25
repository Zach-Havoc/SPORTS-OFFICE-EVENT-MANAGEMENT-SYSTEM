<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Athlete;
use App\Models\CampusStudent;
use App\Models\EmailVerification;
use App\Models\TryoutApplication;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
     * PUT /api/tryouts/{id}/status (coach: own applicants; admin: any)
     *
     * Accepting puts the student on the announcing coach's roster, so the
     * decision actually does something; rejecting just closes it. Either way
     * the applicant is emailed, since they have no account to check.
     */
    public function updateStatus(Request $request, string $id)
    {
        $data = $request->validate([
            'status' => 'required|in:accepted,rejected',
            'note' => 'nullable|string|max:1000',
        ]);

        $user = $request->user();
        $app = TryoutApplication::findOrFail($id);

        if ($user->role === 'coach' && $app->coach_id !== $user->id) {
            return response()->json(['error' => 'This applicant applied to another coach.'], 403);
        }
        if ($app->status !== 'pending') {
            return response()->json(['error' => "This application was already {$app->status}."], 422);
        }

        $athlete = null;
        if ($data['status'] === 'accepted') {
            $coachId = $app->coach_id ?? ($user->role === 'coach' ? $user->id : null);
            if (! $coachId) {
                return response()->json(['error' => 'This application has no coach to add the student to.'], 422);
            }

            $existing = $this->rosterRowFor($app, $coachId);
            if ($existing === false) {
                return response()->json(['error' => "This student is already on another coach's roster."], 422);
            }
        }

        DB::transaction(function () use ($app, $data, $user, &$athlete, &$existing, &$coachId) {
            if ($data['status'] === 'accepted') {
                $athlete = $existing ?: $this->addToRoster($app, $coachId);
            }

            $app->update([
                'status' => $data['status'],
                'review_note' => $data['note'] ?? null,
                'reviewed_by' => $user->id,
                'reviewed_at' => now(),
            ]);
        });

        $this->emailDecision($app);

        return response()->json([
            'application' => $app->fresh(),
            'athleteId' => $athlete?->id,
        ]);
    }

    /**
     * The coach's existing roster row for this applicant, null if there is
     * none yet, or false if another coach's unlinked row already holds the SR
     * Code (athletes.student_id is unique, so a second row can't be made).
     */
    private function rosterRowFor(TryoutApplication $app, string $coachId): Athlete|null|false
    {
        $account = $this->accountFor($app);

        $mine = Athlete::where('coach_id', $coachId)
            ->where(fn ($q) => $account
                ? $q->where('user_id', $account->id)->orWhere('student_id', $app->student_id)
                : $q->where('student_id', $app->student_id))
            ->first();
        if ($mine) {
            return $mine;
        }

        return ! $account && Athlete::where('student_id', $app->student_id)->exists() ? false : null;
    }

    /** Same shape AthleteController::store gives a coach-added athlete. */
    private function addToRoster(TryoutApplication $app, string $coachId): Athlete
    {
        $account = $this->accountFor($app);

        return Athlete::create([
            'id' => (string) Str::uuid(),
            'user_id' => $account?->id,
            'coach_id' => $coachId,
            'sport' => $app->sport,
            'status' => 'active',
            // A linked athlete's identity lives on their account.
            'student_id' => $account ? null : $app->student_id,
            'first_name' => $account ? '' : $app->first_name,
            'last_name' => $account ? '' : $app->last_name,
            'email' => $app->email,
            'department' => $account ? null : $app->department,
            'year_level' => $account ? null : $app->year_level,
        ]);
    }

    /** The applicant's athlete account, if they already signed up. */
    private function accountFor(TryoutApplication $app): ?User
    {
        return User::where('role', 'athlete')
            ->where(fn ($q) => $q->where('sr_code', CampusStudent::normalizeCode($app->student_id))
                ->orWhereRaw('LOWER(email) = ?', [mb_strtolower(trim($app->email))]))
            ->first();
    }

    private function emailDecision(TryoutApplication $app): void
    {
        $sport = $app->sport ? "{$app->sport} " : '';
        $body = $app->status === 'accepted'
            ? "Dear {$app->first_name},\n\nCongratulations! You have been accepted into the {$sport}team after tryouts. Your coach has added you to the roster.\n\nIf you don't have a SportsAxis account yet, sign up as an athlete using your SR Code ({$app->student_id}) to see your schedule, attendance and requirements."
            : "Dear {$app->first_name},\n\nThank you for trying out for the {$sport}team. After careful consideration, we are unable to offer you a slot this time.";
        if ($app->review_note) {
            $body .= "\n\nNote from your coach: {$app->review_note}";
        }
        $body .= "\n\nBest regards,\nThe SportsAxis Team";

        try {
            Mail::raw($body, fn ($m) => $m->to($app->email)->subject('Your SportsAxis tryout result'));
        } catch (\Exception $e) {
            Log::error('Tryout decision email failed to send: '.$e->getMessage());
        }
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
