<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use Illuminate\Http\Request;

/**
 * EventSessionController
 *
 * Handles QR code-based event session lookup for the mobile judge app.
 * The QR code encodes the event's qr_token; this controller resolves
 * that token to the full event + criteria payload.
 */
class EventSessionController extends Controller
{
    /**
     * GET /api/event/session/{qr_token}
     *
     * Look up an event by its QR token and return the event session data.
     * This is a public endpoint (no auth required) so judges can scan
     * before logging in, then authenticate after seeing the event details.
     *
     * Returns event info + criteria array for the dynamic scoring form.
     */
    public function show(string $qrToken)
    {
        $event = Event::where('qr_token', $qrToken)->first();

        if (!$event) {
            return response()->json([
                'error' => 'Invalid QR code. No event found for this token.',
                'code'  => 'INVALID_QR_TOKEN',
            ], 404);
        }

        if ($event->status === 'completed') {
            return response()->json([
                'error' => 'This event has already been completed.',
                'code'  => 'EVENT_COMPLETED',
            ], 422);
        }

        // Format criteria with consistent structure
        $criteria = collect($event->criteria ?? [])->map(function ($c, $index) {
            return [
                'criteria_id' => $c['id'] ?? (string)($index + 1),
                'name'        => $c['name'] ?? 'Criterion ' . ($index + 1),
                'max_score'   => (float)($c['max_score'] ?? 10),
                'weight'      => isset($c['weight']) ? (float)$c['weight'] : null,
            ];
        })->values();

        // Ensure departments and judges are arrays
        $departments = is_array($event->departments) ? $event->departments : [];
        $judges = is_array($event->judges) ? $event->judges : [];

        return response()->json([
            'event' => [
                'id'          => $event->id,
                'name'        => $event->name,
                'category'    => $event->category,
                'schedule'    => $event->schedule,
                'startTime'   => $event->start_time,
                'endTime'     => $event->end_time,
                'venueName'   => $event->venue_name,
                'departments' => $departments,
                'judges'      => $judges,
                'participants' => $judges, // Alias for mobile app
                'status'      => $event->status,
                'qrToken'     => $event->qr_token,
            ],
            'criteria' => $criteria,
        ]);
    }

    /**
     * GET /api/event/{id}/criteria
     *
     * Return only the criteria array for a given event ID.
     * Used by the mobile app after the event session is cached locally
     * to refresh criteria without re-scanning the QR code.
     */
    public function criteria(string $eventId)
    {
        $event = Event::find($eventId);

        if (!$event) {
            return response()->json([
                'error' => 'Event not found.',
                'code'  => 'EVENT_NOT_FOUND',
            ], 404);
        }

        $criteria = collect($event->criteria ?? [])->map(function ($c, $index) {
            return [
                'criteria_id' => $c['id'] ?? (string)($index + 1),
                'name'        => $c['name'] ?? 'Criterion ' . ($index + 1),
                'max_score'   => (float)($c['max_score'] ?? 10),
                'weight'      => isset($c['weight']) ? (float)$c['weight'] : null,
            ];
        })->values();

        return response()->json([
            'event_id' => $event->id,
            'criteria' => $criteria,
        ]);
    }
}
