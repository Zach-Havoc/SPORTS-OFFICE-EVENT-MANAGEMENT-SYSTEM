<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Requirement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class RequirementController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user->role === 'coach') {
            \Log::info('Coach fetching requirements', ['coach_id' => $user->id, 'coach_email' => $user->email]);

            // Get athlete IDs from Athlete table
            $athleteIds = \App\Models\Athlete::where('coach_id', $user->id)->pluck('id');
            \Log::info('Athlete IDs from Athlete table', ['count' => $athleteIds->count(), 'ids' => $athleteIds->toArray()]);

            // Get user IDs from User table where coach_id matches this coach
            $userIds = \App\Models\User::where('coach_id', $user->id)->pluck('id');
            \Log::info('User IDs from User table', ['count' => $userIds->count(), 'ids' => $userIds->toArray()]);

            // Combine both sets of IDs
            $allRelevantIds = $athleteIds->merge($userIds)->unique();
            \Log::info('Combined relevant IDs', ['count' => $allRelevantIds->count(), 'ids' => $allRelevantIds->toArray()]);

            $requirements = Requirement::whereIn('athlete_id', $allRelevantIds)->orderByDesc('submitted_at')->get();
            \Log::info('Requirements fetched', ['count' => $requirements->count()]);

            return response()->json($requirements);
        }

        return response()->json(Requirement::orderByDesc('submitted_at')->get());
    }

    public function myRequirements(Request $request)
    {
        $user = $request->user();
        $athlete = \App\Models\Athlete::where('email', $user->email)->first();

        if (!$athlete) {
            // If no athlete record, return requirements by user_id
            return response()->json(
                Requirement::where('athlete_id', $user->id)->orderByDesc('submitted_at')->get()
            );
        }

        return response()->json(
            Requirement::where('athlete_id', $athlete->id)->orderByDesc('submitted_at')->get()
        );
    }

    public function store(Request $request)
    {
        \Log::info('Requirement submission attempt', [
            'user' => $request->user()?->email,
            'has_file' => $request->hasFile('file'),
            'type' => $request->type,
            'name' => $request->name,
        ]);

        $request->validate([
            'type'        => 'required|string',
            'name'        => 'required|string',
            'file'        => 'required|file|max:10240', // Max 10MB
        ]);

        $user = $request->user();
        \Log::info('Authenticated user', ['user_id' => $user->id, 'email' => $user->email, 'role' => $user->role]);

        $athlete = \App\Models\Athlete::where('email', $user->email)->first();

        // If no athlete record exists, use the user information directly
        $athleteId = $athlete ? $athlete->id : $user->id;
        $athleteName = $athlete ? $athlete->name : $user->name;

        if (!$athlete) {
            \Log::warning('Athlete not found for user email, using user info instead', ['email' => $user->email]);
        } else {
            \Log::info('Athlete found', ['athlete_id' => $athlete->id, 'coach_id' => $athlete->coach_id]);
        }

        $fileUrl = null;
        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $fileName = time() . '_' . $file->getClientOriginalName();
            $filePath = $file->storeAs('requirements', $fileName, 'public');
            $fileUrl = Storage::url($filePath);
            \Log::info('File stored', ['file_path' => $filePath, 'file_url' => $fileUrl]);
        }

        $req = Requirement::create([
            'id'           => Str::uuid(),
            'athlete_id'   => $athleteId,
            'athlete_name' => $athleteName,
            'type'         => $request->type,
            'name'         => $request->name,
            'description'  => $request->description,
            'file_url'     => $fileUrl,
            'status'       => 'pending',
            'submitted_at' => now(),
        ]);

        \Log::info('Requirement created', ['requirement_id' => $req->id]);

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
