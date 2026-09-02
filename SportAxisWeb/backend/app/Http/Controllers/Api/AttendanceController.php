<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AttendanceController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = AttendanceRecord::query()->orderByDesc('date');

        if ($user->role === 'coach') {
            // Only show records for coach's athletes
            $athleteIds = \App\Models\Athlete::where('coach_id', $user->id)->pluck('id');
            $query->whereIn('athlete_id', $athleteIds);
        } elseif ($user->role === 'athlete') {
            // Athlete sees their own records via athlete table
            $athlete = \App\Models\Athlete::where('coach_id', '!=', null)
                ->where('email', $user->email)
                ->first();
            if ($athlete) {
                $query->where('athlete_id', $athlete->id);
            }
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'records'   => 'required|array',
            'records.*.athleteId' => 'required|string',
            'records.*.date'      => 'required|date',
            'records.*.status'    => 'required|in:present,absent,late,excused',
        ]);

        $user = $request->user();
        $created = [];

        // Restrict writes to the coach's own roster so a coach cannot record
        // attendance against another coach's athletes.
        $rosterIds = \App\Models\Athlete::where('coach_id', $user->id)->pluck('id')
            ->merge(\App\Models\User::where('coach_id', $user->id)->pluck('id'))
            ->unique()
            ->flip();

        foreach ($request->records as $rec) {
            if ($user->role === 'coach' && !$rosterIds->has($rec['athleteId'])) {
                continue;
            }
            $record = AttendanceRecord::updateOrCreate(
                ['athlete_id' => $rec['athleteId'], 'date' => $rec['date']],
                [
                    'id'          => Str::uuid(),
                    'event_id'    => $rec['eventId'] ?? null,
                    'status'      => $rec['status'],
                    'notes'       => $rec['notes'] ?? null,
                    'recorded_by' => $user->id,
                    'recorded_at' => now(),
                ]
            );
            $created[] = $record;
        }

        return response()->json($created, 201);
    }
}
