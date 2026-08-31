<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\RegistrationCode;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CoachController extends Controller
{
    /** GET /api/coach/profile */
    public function show(Request $request)
    {
        $user = $request->user();
        $code = RegistrationCode::where('created_by', $user->id)
            ->where('role', 'athlete')
            ->where('used', false)
            ->latest()
            ->first();

        return response()->json([
            'id'             => $user->id,
            'name'           => $user->name,
            'email'          => $user->email,
            'sport'          => $user->sport,             // primary sport (back-compat)
            'sports'         => $user->sportsList(),       // full list
            'genderCategory' => $user->gender_category,
            'enrollmentCode' => $user->enrollment_code,
            'department'     => $user->department,
        ]);
    }

    /** PUT /api/coach/profile */
    public function update(Request $request)
    {
        $request->validate([
            'sports'         => 'sometimes|array',
            'sports.*'       => 'nullable|string|max:100',
            'sport'          => 'sometimes|nullable|string|max:100', // legacy single-sport clients
            'department'     => 'required|string|max:255',
            'genderCategory' => 'nullable|string',
        ]);

        $user = $request->user();
        $department = trim($request->input('department'));

        // Accept either `sports: []` (preferred) or a legacy `sport: "..."`.
        $sports = collect($request->input('sports', []))
            ->push($request->input('sport'))
            ->filter(fn ($s) => is_string($s) && trim($s) !== '')
            ->map(fn ($s) => trim($s))
            ->unique()
            ->values()
            ->all();

        if (empty($sports)) {
            throw ValidationException::withMessages([
                'sports' => ['Select at least one sport.'],
            ]);
        }

        // Intramurals rule: each (department, sport) team has exactly ONE coach.
        $conflicts = User::where('role', 'coach')
            ->where('id', '!=', $user->id)
            ->where('department', $department)
            ->get()
            ->flatMap->sportsList()
            ->unique()
            ->intersect($sports)
            ->values();

        if ($conflicts->isNotEmpty()) {
            throw ValidationException::withMessages([
                'sports' => [
                    "{$department} already has a coach for: " . $conflicts->implode(', ') . '.',
                ],
            ]);
        }

        $primary = $sports[0];

        // Generate an enrollment code the first time a coach sets up their team.
        if (!$user->enrollment_code) {
            $enrollCode = strtoupper(Str::random(8));
            RegistrationCode::create([
                'code'       => $enrollCode,
                'role'       => 'athlete',
                'label'      => "Coach: {$user->name}",
                'created_by' => $user->id,
            ]);
            $user->enrollment_code = $enrollCode;
        }

        $user->update([
            'sports'          => $sports,
            'sport'           => $primary,
            'department'      => $department,
            'gender_category' => $request->genderCategory,
            'enrollment_code' => $user->enrollment_code,
        ]);

        // Only auto-sync athletes' sport when the coach handles exactly one
        // sport — with several, each athlete keeps their own assignment.
        if (count($sports) === 1) {
            \App\Models\User::where('role', 'athlete')
                ->where('coach_id', $user->id)
                ->update(['sport' => $primary]);

            \App\Models\Athlete::where('coach_id', $user->id)
                ->update(['sport' => $primary]);
        }

        return response()->json([
            'sport'          => $user->sport,
            'sports'         => $user->sportsList(),
            'department'     => $user->department,
            'genderCategory' => $user->gender_category,
            'enrollmentCode' => $user->enrollment_code,
        ]);
    }

    /** GET /api/admin/coaches - Get all coaches with their sport and department */
    public function index()
    {
        $coaches = User::where('role', 'coach')
            ->orderBy('name')
            ->get()
            ->map(function ($coach) {
                // Look up department abbreviation
                $departmentAbbreviation = null;
                if ($coach->department) {
                    $dept = \App\Models\Department::where('name', $coach->department)->first();
                    $departmentAbbreviation = $dept ? $dept->abbreviation : null;
                }

                // Extract gender from sport (e.g., "Basketball Men" -> "Men")
                $gender = null;
                if ($coach->sport) {
                    if (stripos($coach->sport, 'Men') !== false) {
                        $gender = 'Men';
                    } elseif (stripos($coach->sport, 'Women') !== false) {
                        $gender = 'Women';
                    }
                }

                return [
                    'id' => $coach->id,
                    'name' => $coach->name,
                    'email' => $coach->email,
                    'sport' => $coach->sport,          // primary
                    'sports' => $coach->sportsList(),  // full list
                    'department' => $coach->department,
                    'departmentAbbreviation' => $departmentAbbreviation,
                    'gender' => $gender,
                    'enrollmentCode' => $coach->enrollment_code,
                ];
            });

        return response()->json($coaches);
    }

    /** PUT /api/admin/coaches/{id} - Update coach department */
    public function updateCoach(Request $request, string $id)
    {
        \Log::info('Updating coach department', ['id' => $id, 'department' => $request->department]);

        $coach = User::where('role', 'coach')->findOrFail($id);

        $request->validate([
            'department' => 'nullable|string',
        ]);

        // Handle null or empty string by setting to null
        $department = $request->department === '' ? null : $request->department;
        \Log::info('Processed department value', ['department' => $department]);

        // Moving a coach into a department must not create two coaches for the
        // same (department, sport) team.
        if ($department) {
            $conflicts = User::where('role', 'coach')
                ->where('id', '!=', $coach->id)
                ->where('department', $department)
                ->get()
                ->flatMap->sportsList()
                ->unique()
                ->intersect($coach->sportsList())
                ->values();

            if ($conflicts->isNotEmpty()) {
                throw ValidationException::withMessages([
                    'department' => [
                        "{$department} already has a coach for: " . $conflicts->implode(', ') . '.',
                    ],
                ]);
            }
        }

        $coach->update(['department' => $department]);

        \Log::info('Coach updated successfully', ['id' => $coach->id, 'department' => $coach->department]);

        return response()->json([
            'id' => $coach->id,
            'name' => $coach->name,
            'department' => $coach->department,
        ]);
    }
}
