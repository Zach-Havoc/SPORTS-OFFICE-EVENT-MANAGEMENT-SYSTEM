<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Athlete;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AthleteController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Athlete::query();
        if ($user->role === 'coach') {
            $query->where('coach_id', $user->id);
        }

        return response()->json($query->orderBy('last_name')->get());
    }

    public function show(string $id)
    {
        return response()->json(Athlete::findOrFail($id));
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
        $athlete = Athlete::findOrFail($id);

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

    public function destroy(string $id)
    {
        Athlete::findOrFail($id)->delete();
        return response()->json(['message' => 'Athlete deleted']);
    }

    /** DELETE /athletes/{id}/remove — removes athlete from coach's roster (sets coach_id to null) */
    public function removeFromRoster(string $id)
    {
        $athlete = Athlete::findOrFail($id);
        $athlete->update(['coach_id' => null]);
        return response()->json(['message' => 'Athlete removed from roster']);
    }
}
