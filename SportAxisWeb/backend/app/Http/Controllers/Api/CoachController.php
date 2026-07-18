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
            'enrollmentCode' => $user->enrollment_code,
        ]);
    }

    /** PUT /api/coach/profile */
    public function update(Request $request)
    {
        $request->validate(['sport' => 'required|string']);

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
            $user->update(['sport' => $request->sport, 'enrollment_code' => $enrollCode]);
        } else {
            $user->update(['sport' => $request->sport]);
        }

        return response()->json([
            'sport'          => $user->sport,
            'enrollmentCode' => $user->enrollment_code,
        ]);
    }
}
