<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;

/**
 * EventSessionController
 *
 * Handles QR code-based event session lookup for the mobile scoring app.
 * The QR code encodes the event's qr_token; this controller resolves that
 * token to the event payload the scoring screen needs.
 */
class EventSessionController extends Controller
{
    /**
     * GET /api/event/session/{qr_token}
     *
     * Look up an event by its QR token and return the event session data.
     * Public (no auth) so scorers can scan before logging in, then
     * authenticate after seeing the event details.
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

        return response()->json([
            'event' => [
                'id'          => $event->id,
                'name'        => $event->name,
                'category'    => $event->category,
                'schedule'    => $event->schedule,
                'startTime'   => $event->start_time,
                'endTime'     => $event->end_time,
                'venueName'   => $event->venue_name,
                'departments' => $event->departments ?? [],
                'judges'      => $event->judges ?? [],
                'status'      => $event->status,
                'qrToken'     => $event->qr_token,
            ],
        ]);
    }
}
