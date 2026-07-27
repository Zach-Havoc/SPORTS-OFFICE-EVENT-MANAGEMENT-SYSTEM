<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TryoutApplication;
use App\Models\EmailVerification;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Mail;

class TryoutController extends Controller
{
    /** POST /api/tryouts/verify-email (public) */
    public function verifyEmail(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $code = str_pad((string) rand(0, 999999), 6, '0', STR_PAD_LEFT);

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
            \Illuminate\Support\Facades\Log::error('Tryout verification email failed to send: ' . $e->getMessage());
        }

        $response = ['message' => 'Verification code sent'];

        // Include dev code in response for local testing if mail sending failed or mailer is log
        if (!$mailSent || config('app.env') === 'local' || config('app.debug') || config('mail.default') === 'log') {
            $response['dev_code'] = $code;
        }

        return response()->json($response);
    }

    /** POST /api/tryouts/apply (public) */
    public function apply(Request $request)
    {
        $request->validate([
            'firstName'        => 'required|string',
            'lastName'         => 'required|string',
            'email'            => 'required|email',
            'studentId'        => 'required|string',
            'department'       => 'required|string',
            'phone'            => 'required|string',
            'yearLevel'        => 'nullable|string',
            'sport'            => 'nullable|string',
            'verificationCode' => 'required|string',
        ]);

        // Validate verification code
        $verification = EmailVerification::where('email', $request->email)->first();

        if (!$verification || (string) $verification->code !== (string) trim($request->verificationCode)) {
            return response()->json(['message' => 'Invalid verification code.'], 422);
        }

        if ($verification->expires_at && $verification->expires_at->isPast()) {
            return response()->json(['message' => 'Verification code has expired. Please request a new code.'], 422);
        }

        // Code is valid - consume it
        $verification->delete();

        $app = TryoutApplication::create([
            'id'              => Str::uuid(),
            'announcement_id' => $request->announcementId,
            'sport'           => $request->sport,
            'coach_id'        => $request->coachId,
            'first_name'      => $request->firstName,
            'last_name'       => $request->lastName,
            'email'           => $request->email,
            'student_id'      => $request->studentId,
            'department'      => $request->department,
            'phone'           => $request->phone,
            'year_level'      => $request->yearLevel ?? '1st Year',
            'applied_at'      => now(),
        ]);

        return response()->json($app, 201);
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
