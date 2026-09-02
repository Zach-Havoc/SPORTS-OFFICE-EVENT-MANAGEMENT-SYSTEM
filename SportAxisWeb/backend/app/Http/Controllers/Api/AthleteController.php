<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Athlete;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class AthleteController extends Controller
{
    /**
     * Fetch an athlete, enforcing that the current coach owns it.
     * Admins may access any athlete. Anyone else gets a 404 (rather than a
     * 403) so we don't disclose that the record exists.
     */
    private function findOwnedAthlete(Request $request, string $id): Athlete
    {
        $athlete = Athlete::findOrFail($id);
        $user    = $request->user();

        if ($user->role !== 'admin' && $athlete->coach_id !== $user->id) {
            throw new NotFoundHttpException('Athlete not found');
        }

        return $athlete;
    }
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Athlete::query();
        if ($user->role === 'coach') {
            $query->where('coach_id', $user->id);
        }

        $athletes = $query->orderBy('last_name')->get();

        // Also include users who have this coach_id but no athlete record
        if ($user->role === 'coach') {
            $usersWithCoach = \App\Models\User::where('coach_id', $user->id)
                ->where('role', 'athlete')
                ->whereNotIn('id', $athletes->pluck('id'))
                ->get();

            // Convert users to athlete-like format
            $userAthletes = $usersWithCoach->map(function ($u) {
                return [
                    'id' => $u->id,
                    'student_id' => null,
                    'first_name' => $u->name,
                    'last_name' => '',
                    'email' => $u->email,
                    'department' => null,
                    'year_level' => null,
                    'course' => null,
                    'sport' => $u->sport,
                    'coach_id' => $u->coach_id,
                    'status' => 'active',
                    'enrolled_via_code' => true,
                    'enrolled_at' => $u->enrolled_at,
                    'emergency_contact' => null,
                    'created_at' => $u->created_at,
                ];
            });

            $athletes = $athletes->concat($userAthletes);
        }

        return response()->json($athletes);
    }

    public function show(Request $request, string $id)
    {
        return response()->json($this->findOwnedAthlete($request, $id));
    }

    public function store(Request $request)
    {
        $request->validate([
            'studentId' => 'required|string|unique:athletes,student_id',
            'firstName' => 'required|string',
            'lastName'  => 'required|string',
            'email'     => 'required|email',
        ]);

        $athlete = Athlete::create([
            'id'                => Str::uuid(),
            'student_id'        => $request->studentId,
            'first_name'        => $request->firstName,
            'last_name'         => $request->lastName,
            'email'             => $request->email,
            'department'        => $request->department,
            'year_level'        => $request->yearLevel,
            'course'            => $request->course,
            'coach_id'          => $request->user()->id,
            'sport'             => $request->sport,
            'status'            => $request->status ?? 'active',
            'emergency_contact' => $request->emergencyContact,
        ]);

        return response()->json($athlete, 201);
    }

    public function update(Request $request, string $id)
    {
        $athlete = $this->findOwnedAthlete($request, $id);

        $request->validate([
            'email' => 'sometimes|email',
        ]);

        $athlete->update(array_filter([
            'first_name'        => $request->firstName,
            'last_name'         => $request->lastName,
            'email'             => $request->email,
            'department'        => $request->department,
            'year_level'        => $request->yearLevel,
            'course'            => $request->course,
            'sport'             => $request->sport,
            'status'            => $request->status,
            'emergency_contact' => $request->emergencyContact,
        ], fn($v) => !is_null($v)));

        return response()->json($athlete->fresh());
    }

    public function destroy(Request $request, string $id)
    {
        $this->findOwnedAthlete($request, $id)->delete();
        return response()->json(['message' => 'Athlete deleted']);
    }

    /** DELETE /athletes/{id}/remove — removes athlete from coach's roster (sets coach_id to null) */
    public function removeFromRoster(Request $request, string $id)
    {
        $athlete = $this->findOwnedAthlete($request, $id);
        $athlete->update(['coach_id' => null]);
        return response()->json(['message' => 'Athlete removed from roster']);
    }
}
