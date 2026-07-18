<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Requirement;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class RequirementController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user->role === 'coach') {
            $athleteIds = \App\Models\Athlete::where('coach_id', $user->id)->pluck('id');
            return response()->json(
                Requirement::whereIn('athlete_id', $athleteIds)->orderByDesc('submitted_at')->get()
            );
        }

        return response()->json(Requirement::orderByDesc('submitted_at')->get());
    }

    public function myRequirements(Request $request)
    {
        $user = $request->user();
        $athlete = \App\Models\Athlete::where('email', $user->email)->first();

        if (!$athlete) {
            return response()->json([]);
        }

        return response()->json(
            Requirement::where('athlete_id', $athlete->id)->orderByDesc('submitted_at')->get()
        );
    }

    public function store(Request $request)
    {
        $request->validate([
            'athleteId'   => 'required|string',
            'athleteName' => 'required|string',
            'type'        => 'required|string',
            'name'        => 'required|string',
        ]);

        $req = Requirement::create([
            'id'           => Str::uuid(),
            'athlete_id'   => $request->athleteId,
            'athlete_name' => $request->athleteName,
            'type'         => $request->type,
            'name'         => $request->name,
            'description'  => $request->description,
            'file_url'     => $request->fileUrl,
            'submitted_at' => now(),
        ]);

        return response()->json($req, 201);
    }

    public function updateStatus(Request $request, string $id)
    {
        $request->validate([
            'status' => 'required|in:pending,approved,rejected',
            'notes'  => 'nullable|string',
        ]);

        $req = Requirement::findOrFail($id);
        $req->update([
            'status'      => $request->status,
            'notes'       => $request->notes,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        return response()->json($req->fresh());
    }
}
