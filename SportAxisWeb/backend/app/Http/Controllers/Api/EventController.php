<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\Venue;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class EventController extends Controller
{
    public function index()
    {
        $events = Event::orderBy('schedule', 'desc')->get();
        return response()->json($events->map(fn($e) => $e->toApiFormat()));
    }

    public function show(string $id)
    {
        $event = Event::findOrFail($id);
        return response()->json($event->toApiFormat());
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'        => 'required|string',
            'category'    => 'required|string',
            'schedule'    => 'required|date',
            'startTime'   => 'required|string',
            'endTime'     => 'required|string',
            'departments' => 'required|array',
            'criteria'    => 'required|array',
            'status'      => 'in:upcoming,ongoing,completed',
        ]);

        // Resolve venue name
        $venueName = null;
        if ($request->venueId) {
            $venue = Venue::find($request->venueId);
            $venueName = $venue?->name;
        }

        $event = Event::create([
            'id'         => Str::uuid(),
            'name'       => $request->name,
            'category'   => $request->category,
            'schedule'   => $request->schedule,
            'start_time' => $request->startTime,
            'end_time'   => $request->endTime,
            'venue_id'   => $request->venueId,
            'venue_name' => $venueName ?? $request->venueName,
            'departments'=> $request->departments,
            'judges'     => $request->judges ?? [],
            'criteria'   => $request->criteria,
            'status'     => $request->status ?? 'upcoming',
            'qr_token'   => Str::random(32),
        ]);

        return response()->json($event->toApiFormat(), 201);
    }

    public function update(Request $request, string $id)
    {
        $event = Event::findOrFail($id);

        $request->validate([
            'name'     => 'sometimes|string',
            'schedule' => 'sometimes|date',
            'status'   => 'sometimes|in:upcoming,ongoing,completed',
        ]);

        $data = array_filter([
            'name'       => $request->name,
            'category'   => $request->category,
            'schedule'   => $request->schedule,
            'start_time' => $request->startTime,
            'end_time'   => $request->endTime,
            'venue_id'   => $request->venueId,
            'venue_name' => $request->venueName,
            'departments'=> $request->departments,
            'judges'     => $request->judges,
            'criteria'   => $request->criteria,
            'status'     => $request->status,
        ], fn($v) => !is_null($v));

        $event->update($data);
        return response()->json($event->fresh()->toApiFormat());
    }

    public function destroy(string $id)
    {
        Event::findOrFail($id)->delete();
        return response()->json(['message' => 'Event deleted']);
    }
}
