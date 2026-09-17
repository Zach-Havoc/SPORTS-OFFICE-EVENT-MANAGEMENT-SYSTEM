<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Pushed the instant a committee member changes a running score, so the public
 * board and every coach/athlete watching update within ~1s instead of on the
 * next poll.
 *
 * Broadcast on two public channels:
 *   live-scores            — the whole board
 *   live-scores.{eventId}  — one game's detail view
 *
 * The payload is exactly what `PUT /api/events/{id}/live` returns, so a socket
 * message and an HTTP response are interchangeable on the client.
 */
class LiveScoreUpdated implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    /** @param  array<string, mixed>  $live  the live score in API shape */
    public function __construct(public array $live) {}

    /** @return array<int, Channel> */
    public function broadcastOn(): array
    {
        $eventId = $this->live['eventId'] ?? null;

        return array_values(array_filter([
            new Channel('live-scores'),
            $eventId ? new Channel('live-scores.'.$eventId) : null,
        ]));
    }

    public function broadcastAs(): string
    {
        return 'updated';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return ['live' => $this->live];
    }
}
