<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\RegistrationCode;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

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
            'sport'          => $user->sport,
            'genderCategory' => $user->gender_category,
            'enrollmentCode' => $user->enrollment_code,
            'department'     => $user->department,
        ]);
    }

    /** PUT /api/coach/profile */
    public function update(Request $request)
    {
        $request->validate([
            'sport' => 'required|string',
            'genderCategory' => 'nullable|string'
        ]);

        $user = $request->user();

        // Generate enrollment code if not set
        if (!$user->enrollment_code) {
            $enrollCode = strtoupper(Str::random(8));
            // Create an athlete registration code linked to this coach
            RegistrationCode::create([
                'code'       => $enrollCode,
                'role'       => 'athlete',
                'label'      => "Coach: {$user->name}",
                'created_by' => $user->id,
            ]);
            $user->update([
                'sport' => $request->sport, 
                'gender_category' => $request->genderCategory,
                'enrollment_code' => $enrollCode
            ]);
        } else {
            $user->update([
                'sport' => $request->sport,
                'gender_category' => $request->genderCategory
            ]);
        }

        // Cascade the sport change to all athletes enrolled under this coach
        \App\Models\User::where('role', 'athlete')
            ->where('coach_id', $user->id)
            ->update(['sport' => $request->sport]);

        \App\Models\Athlete::where('coach_id', $user->id)
            ->update(['sport' => $request->sport]);

        return response()->json([
            'sport'          => $user->sport,
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
                    'sport' => $coach->sport,
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

        $coach->update(['department' => $department]);

        \Log::info('Coach updated successfully', ['id' => $coach->id, 'department' => $coach->department]);

        return response()->json([
            'id' => $coach->id,
            'name' => $coach->name,
            'department' => $coach->department,
        ]);
    }
}
