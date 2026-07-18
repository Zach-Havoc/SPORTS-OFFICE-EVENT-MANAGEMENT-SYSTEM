<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\RegistrationCode;
use Illuminate\Http\Request;

class EnrollController extends Controller
{
    /** POST /api/enroll */
    public function enroll(Request $request)
    {
        $request->validate(['enrollmentCode' => 'required|string']);

        $athlete = $request->user();

        if ($athlete->coach_id) {
            return response()->json(['error' => 'You are already enrolled with a coach'], 400);
        }

        // Find coach with this enrollment code
        $coach = User::where('enrollment_code', $request->enrollmentCode)
            ->where('role', 'coach')
            ->first();

        if (!$coach) {
            return response()->json(['error' => 'Invalid enrollment code'], 400);
        }

        $athlete->update([
            'coach_id'    => $coach->id,
            'coach_name'  => $coach->name,
            'sport'       => $coach->sport,
            'enrolled_at' => now(),
        ]);

        return response()->json([
            'message'   => 'Enrolled successfully',
            'coachName' => $coach->name,
            'sport'     => $coach->sport,
        ]);
    }

    /** DELETE /api/unenroll */
    public function unenroll(Request $request)
    {
        $request->user()->update([
            'coach_id'    => null,
            'coach_name'  => null,
            'enrolled_at' => null,
        ]);

        return response()->json(['message' => 'Unenrolled successfully']);
    }

    /** GET /api/my-coach */
    public function myCoach(Request $request)
    {
        $user = $request->user();

        if (!$user->coach_id) {
            return response()->json([
                'enrolled' => false,
                'coach'    => null,
            ]);
        }

        $coach = User::find($user->coach_id);

        return response()->json([
            'enrolled'   => true,
            'sport'      => $user->sport,
            'enrolledAt' => $user->enrolled_at,
            'coach'      => $coach ? [
                'id'    => $coach->id,
                'name'  => $coach->name,
                'sport' => $coach->sport,
                'email' => $coach->email,
            ] : null,
        ]);
    }
}
