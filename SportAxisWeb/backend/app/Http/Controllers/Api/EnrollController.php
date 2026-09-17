<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Athlete;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

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

        if (! $coach) {
            return response()->json(['error' => 'Invalid enrollment code'], 400);
        }

        // Intramurals are department-based: an athlete joins their OWN
        // department's team for the coach's sport.
        if (! $coach->department) {
            return response()->json([
                'error' => 'This coach has not been assigned to a college yet. Please contact your administrator.',
            ], 400);
        }

        if ($athlete->department && $athlete->department !== $coach->department) {
            return response()->json([
                'error' => "This code belongs to {$coach->department}. Your account is registered under {$athlete->department}.",
            ], 400);
        }

        $updates = [
            'coach_id' => $coach->id,
            'coach_name' => $coach->name,
            'sport' => $coach->sport,
            'enrolled_at' => now(),
        ];

        // Athletes who signed up without a department inherit the coach's.
        if (! $athlete->department) {
            $updates['department'] = $coach->department;
        }

        $athlete->update($updates);
        $fresh = $athlete->fresh();

        // Make sure the coach's roster carries a record for this athlete, linked
        // to their account so the two stay in sync. Reuse a roster row the coach
        // already added for this email if there is one.
        $roster = Athlete::where('coach_id', $coach->id)
            ->where(function ($q) use ($fresh) {
                $q->where('user_id', $fresh->id)
                    ->orWhere(function ($q2) use ($fresh) {
                        $q2->whereNull('user_id')
                            ->whereRaw('LOWER(email) = ?', [mb_strtolower(trim((string) $fresh->email))]);
                    });
            })
            ->first();

        if (! $roster) {
            $roster = new Athlete(['id' => (string) Str::uuid()]);
        }

        // The roster row just links the athlete to this coach + sport. Every
        // personal detail is read from the linked account.
        $roster->forceFill([
            'user_id' => $fresh->id,
            'email' => $fresh->email,
            'coach_id' => $coach->id,
            'sport' => $coach->sport,
            'status' => $roster->status ?: 'active',
            'enrolled_via_code' => true,
            'enrolled_at' => now(),
        ])->save();

        return response()->json([
            'message' => 'Enrolled successfully',
            'coachName' => $coach->name,
            'sport' => $coach->sport,
            'department' => $fresh->department,
        ]);
    }

    /** DELETE /api/unenroll */
    public function unenroll(Request $request)
    {
        $user = $request->user();

        $user->update([
            'coach_id' => null,
            'coach_name' => null,
            'enrolled_at' => null,
        ]);

        // Drop the athlete off their coach's roster too (keep the row so any
        // coach-entered detail survives a re-enrolment).
        Athlete::where('user_id', $user->id)->update(['coach_id' => null]);

        return response()->json(['message' => 'Unenrolled successfully']);
    }

    /** GET /api/my-coach */
    public function myCoach(Request $request)
    {
        $user = $request->user();

        if (! $user->coach_id) {
            return response()->json([
                'enrolled' => false,
                'coach' => null,
            ]);
        }

        $coach = User::find($user->coach_id);

        return response()->json([
            'enrolled' => true,
            'sport' => $user->sport,
            'enrolledAt' => $user->enrolled_at,
            'coach' => $coach ? [
                'id' => $coach->id,
                'name' => $coach->name,
                'sport' => $coach->sport,
                'email' => $coach->email,
            ] : null,
        ]);
    }

    /**
     * GET /api/my-team — the athlete's teammates (other account-holders under
     * the same coach) and that coach's announcements.
     */
    public function myTeam(Request $request)
    {
        $user = $request->user();

        if (! $user->coach_id) {
            return response()->json(['coach' => null, 'teammates' => [], 'announcements' => []]);
        }

        $coach = User::find($user->coach_id);
        if (! $coach) {
            return response()->json(['coach' => null, 'teammates' => [], 'announcements' => []]);
        }

        $teammates = User::where('coach_id', $coach->id)
            ->where('id', '!=', $user->id)
            ->orderBy('name')
            ->get(['id', 'name', 'department', 'year_level', 'sport'])
            ->map(fn (User $t) => [
                'id' => $t->id,
                'name' => $t->name,
                'department' => $t->department,
                'yearLevel' => $t->year_level,
            ]);

        $announcements = Announcement::where('coach_id', $coach->id)
            ->orderByDesc('created_at')
            ->limit(20)
            ->get(['id', 'title', 'content', 'sport', 'is_tryout', 'created_at']);

        return response()->json([
            'coach' => ['id' => $coach->id, 'name' => $coach->name, 'email' => $coach->email, 'sport' => $coach->sport],
            'teammates' => $teammates,
            'announcements' => $announcements,
        ]);
    }
}
