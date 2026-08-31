<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\RegistrationCode;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /** POST /api/signup */
    public function signup(Request $request)
    {
        $request->validate([
            'email'            => 'required|email|unique:users,email',
            'password'         => 'required|string|min:8',
            'name'             => 'required|string|max:255',
            'role'             => 'required|in:admin,coach,athlete,judge',
            'registrationCode' => 'required|string',
        ]);

        // Validate registration code
        $code = RegistrationCode::where('code', $request->registrationCode)
            ->where('role', $request->role)
            ->where('used', false)
            ->first();

        if (!$code) {
            return response()->json(['error' => 'Invalid or expired registration code'], 400);
        }

        if ($code->expires_at && $code->expires_at->isPast()) {
            return response()->json(['error' => 'Registration code has expired'], 400);
        }

        $user = User::create([
            'id'       => Str::uuid(),
            'email'    => $request->email,
            'password' => Hash::make($request->password),
            'name'     => $request->name,
            'role'     => $request->role,
        ]);

        // Mark code as used
        $code->update([
            'used'    => true,
            'used_by' => $user->id,
            'used_at' => now(),
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => $user->toApiFormat(),
        ], 201);
    }

    /** POST /api/login */
    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid email or password.'],
            ]);
        }

        // Revoke old tokens
        $user->tokens()->delete();
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => $user->toApiFormat(),
        ]);
    }

    /** POST /api/logout */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out successfully']);
    }

    /** GET /api/user */
    public function user(Request $request)
    {
        return response()->json($request->user()->toApiFormat());
    }

    /** PUT /api/account/profile */
    public function updateProfile(Request $request)
    {
        $request->validate(['name' => 'required|string|max:255']);

        $request->user()->update(['name' => $request->name]);

        return response()->json([
            'message' => 'Profile updated',
            'user'    => $request->user()->fresh()->toApiFormat(),
        ]);
    }

    /** PUT /api/account/password */
    public function updatePassword(Request $request)
    {
        $request->validate([
            'currentPassword' => 'required',
            'newPassword'     => 'required|string|min:8',
        ]);

        $user = $request->user();

        if (!Hash::check($request->currentPassword, $user->password)) {
            return response()->json(['error' => 'Current password is incorrect'], 400);
        }

        $user->update(['password' => Hash::make($request->newPassword)]);

        return response()->json(['message' => 'Password updated successfully']);
    }

    /** POST /api/reset-password */
    public function resetPassword(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $genericResponse = response()->json([
            'message' => 'If that email exists, a reset link has been sent.',
        ]);

        $user = User::where('email', $request->email)->first();
        if (!$user) {
            // Don't reveal if email exists
            return $genericResponse;
        }

        // Per-account cooldown. This endpoint overwrites the account password
        // immediately, so without a cooldown an attacker can repeatedly reset a
        // known victim's password and permanently lock them out (and mail-bomb
        // them). The route-level throttle limits volume; this limits how often
        // any single account can be forcibly reset.
        // NOTE (needs product decision): the correct long-term fix is a signed,
        // single-use reset *token* emailed to the user that only changes the
        // password after the user follows the link — the real password should
        // not be invalidated until then. That requires a frontend reset page.
        $cooldownKey = 'pwreset:' . sha1(strtolower($request->email));
        if (\Illuminate\Support\Facades\Cache::has($cooldownKey)) {
            return $genericResponse;
        }
        \Illuminate\Support\Facades\Cache::put($cooldownKey, true, now()->addMinutes(15));

        // Generate a temporary password
        $tempPassword = Str::random(12);
        $user->update(['password' => Hash::make($tempPassword)]);

        try {
            Mail::raw(
                "Dear User,\n\nWe received a request to reset your password for your SportsAxis account. Your temporary password is: {$tempPassword}\n\nFor your security, please log in and change your password immediately.\n\nIf you did not request this change, please contact your administrator.\n\nBest regards,\nThe SportsAxis Team",
                function ($message) use ($user) {
                    $message->to($user->email)
                        ->subject('SportsAxis Password Reset');
                }
            );
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to send email. Please contact admin.'], 500);
        }

        return response()->json(['message' => 'If that email exists, a reset link has been sent.']);
    }
}
