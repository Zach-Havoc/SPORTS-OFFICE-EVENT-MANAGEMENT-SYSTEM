<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/** An admin reset a game's live score; clients should drop it from the board. */
class LiveScoreCleared implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(public string $eventId) {}

    /** @return array<int, Channel> */
    public function broadcastOn(): array
    {
        return [
            new Channel('live-scores'),
            new Channel('live-scores.'.$this->eventId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'cleared';
    }

    /** @return array<string, string> */
    public function broadcastWith(): array
    {
        return ['eventId' => $this->eventId];
    }
}
