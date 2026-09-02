<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Event;
use App\Models\Venue;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class EventController extends Controller
{
    /**
     * Reject a roster that doesn't fit how the sport is contested:
     *   versus → exactly two distinct colleges (one game)
     *   ranked → two or more
     * Returns an error phrase, or null when the roster is fine.
     */
    private function rosterError(?string $category, array $departments): ?string
    {
        $depts = array_values(array_unique(array_filter(
            array_map(fn ($d) => is_string($d) ? trim($d) : $d, $departments)
        )));

        $format = Category::where('name', $category)->value('format') ?: 'ranked';

        if ($format === 'versus' && count($depts) !== 2) {
            return 'Two-team sport — pick exactly two colleges.';
        }
        if (count($depts) < 2) {
            return 'Pick at least two colleges.';
        }

        return null;
    }

    public function index(Request $request)
    {
        $query = Event::orderBy('schedule', 'asc');

        if ($request->has('date') && $request->date) {
            $query->whereDate('schedule', $request->date);
        }

        $events = $query->get();
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
            'status'      => 'in:upcoming,ongoing,completed',
        ], [], ['category' => 'sport']);

        if ($rosterError = $this->rosterError($request->category, (array) $request->departments)) {
            return response()->json(['error' => $rosterError], 422);
        }

        // Resolve venue name
        $venueName = null;
        if ($request->venueId) {
            $venue = Venue::find($request->venueId);
            $venueName = $venue?->name;
        }
        $venueName = $venueName ?? $request->venueName;

        // Block double-booking: same venue, same day, overlapping time.
        $conflicts = Event::venueConflicts(
            $request->venueId,
            $venueName,
            $request->schedule,
            $request->startTime,
            $request->endTime,
        );
        if ($conflicts->isNotEmpty()) {
            return response()->json([
                'error'     => Event::conflictMessage($conflicts->first()),
                'conflicts' => $conflicts->map->toApiFormat(),
            ], 422);
        }

        $event = Event::create([
            'id'         => Str::uuid(),
            'name'       => $request->name,
            'category'   => $request->category,
            'schedule'   => $request->schedule,
            'start_time' => $request->startTime,
            'end_time'   => $request->endTime,
            'venue_id'   => $request->venueId,
            'venue_name' => $venueName,
            'departments'=> $request->departments,
            'judges'     => $request->judges ?? [],
            'criteria'   => [],
            'status'     => $request->status ?? 'upcoming',
            'qr_token'   => Str::random(32),
        ]);

        return response()->json($event->toApiFormat(), 201);
    }

    public function update(Request $request, string $id)
    {
        $event = Event::findOrFail($id);

        $request->validate([
            'name'        => 'sometimes|string',
            'category'    => 'sometimes|string',
            'schedule'    => 'sometimes|date',
            'startTime'   => 'sometimes|string',
            'endTime'     => 'sometimes|string',
            'venueId'     => 'sometimes|string',
            'venueName'   => 'sometimes|string',
            'departments' => 'sometimes|array',
            'judges'      => 'sometimes|array',
            'status'      => 'sometimes|in:upcoming,ongoing,completed',
        ], [], ['category' => 'sport']);

        // Re-check the roster whenever the colleges or the sport change.
        if ($request->has('departments') || $request->has('category')) {
            $category = $request->input('category', $event->category);
            $depts    = $request->has('departments') ? (array) $request->departments : ($event->departments ?? []);
            if ($rosterError = $this->rosterError($category, $depts)) {
                return response()->json(['error' => $rosterError], 422);
            }
        }

        // Only re-check for double-booking when this request actually moves the
        // event in time or space (not on a bare status flip). Compared against
        // every other event, using the new value where sent, the current
        // value otherwise.
        $touchesSchedule = $request->hasAny(['venueId', 'venueName', 'schedule', 'startTime', 'endTime']);
        if ($touchesSchedule) {
            $conflicts = Event::venueConflicts(
                $request->has('venueId')   ? $request->venueId   : $event->venue_id,
                $request->has('venueName') ? $request->venueName : $event->venue_name,
                $request->has('schedule')  ? $request->schedule  : $event->schedule,
                $request->has('startTime') ? $request->startTime : $event->start_time,
                $request->has('endTime')   ? $request->endTime   : $event->end_time,
                $event->id,
            );
            if ($conflicts->isNotEmpty()) {
                return response()->json([
                    'error'     => Event::conflictMessage($conflicts->first()),
                    'conflicts' => $conflicts->map->toApiFormat(),
                ], 422);
            }
        }

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

    /** POST /api/events/bulk-delete  { ids: [] } — delete many in one request. */
    public function bulkDestroy(Request $request)
    {
        $data = $request->validate([
            'ids'   => 'required|array|min:1',
            'ids.*' => 'string',
        ]);

        $deleted = Event::whereIn('id', $data['ids'])->delete();

        return response()->json(['deleted' => $deleted]);
    }

    /** POST /api/events/bulk-status  { ids: [], status } — update status for many. */
    public function bulkStatus(Request $request)
    {
        $data = $request->validate([
            'ids'    => 'required|array|min:1',
            'ids.*'  => 'string',
            'status' => 'required|in:upcoming,ongoing,completed',
        ]);

        $updated = Event::whereIn('id', $data['ids'])->update(['status' => $data['status']]);

        return response()->json(['updated' => $updated]);
    }
}
