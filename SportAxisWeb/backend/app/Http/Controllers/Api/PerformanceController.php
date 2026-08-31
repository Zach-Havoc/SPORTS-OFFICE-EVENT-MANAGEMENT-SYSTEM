<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PerformanceRecord;
use App\Models\Athlete;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PerformanceController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = PerformanceRecord::query()->orderByDesc('recorded_at');

        if ($user->role === 'coach') {
            $athleteIds = Athlete::where('coach_id', $user->id)->pluck('id');
            $query->whereIn('athlete_id', $athleteIds);
        }

        return response()->json($query->get());
    }

    public function myRecords(Request $request)
    {
        $user = $request->user();
        $athlete = Athlete::where('email', $user->email)->first();

        if (!$athlete) {
            return response()->json([]);
        }

        $records = PerformanceRecord::where('athlete_id', $athlete->id)
            ->orderByDesc('recorded_at')
            ->get();

        return response()->json($records);
    }

    public function store(Request $request)
    {
        $request->validate([
            'athleteId'     => 'required|string',
            'athleteName'   => 'required|string',
            'overallRating' => 'nullable|integer|min:1|max:10',
        ]);

        $user = $request->user();

        // A coach may only record performance for athletes on their own roster.
        if ($user->role === 'coach') {
            $onRoster = Athlete::where('coach_id', $user->id)->where('id', $request->athleteId)->exists()
                || \App\Models\User::where('coach_id', $user->id)->where('id', $request->athleteId)->exists();

            if (!$onRoster) {
                return response()->json(['error' => 'Athlete is not on your roster'], 403);
            }
        }

        $record = PerformanceRecord::create([
            'id'             => Str::uuid(),
            'athlete_id'     => $request->athleteId,
            'athlete_name'   => $request->athleteName,
            'event_id'       => $request->eventId,
            'event_name'     => $request->eventName,
            'sport'          => $request->sport,
            'metrics'        => $request->metrics ?? [],
            'overall_rating' => $request->overallRating ?? 5,
            'coach_notes'    => $request->coachNotes,
            'recorded_by'    => $user->id,
            'recorded_at'    => now(),
        ]);

        return response()->json($record, 201);
    }
}
