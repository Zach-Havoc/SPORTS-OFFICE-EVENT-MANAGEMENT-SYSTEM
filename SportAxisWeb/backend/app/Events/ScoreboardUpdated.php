<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * The full play-by-play scoreboard of one basketball game, pushed after every
 * play, undo, player assignment, roster edit, period change and finish.
 *
 * Broadcast on the public `live-scores.{eventId}` channel as `.scoreboard`.
 * It carries the whole state, not a delta, so a viewer that missed a message
 * is correct again on the next one. The payload is exactly what
 * `GET /api/events/{id}/scoreboard` returns.
 */
class ScoreboardUpdated implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    /** @param  array<string, mixed>  $scoreboard  BasketballScoreboard::build() */
    public function __construct(public array $scoreboard) {}

    /** @return array<int, Channel> */
    public function broadcastOn(): array
    {
        return [new Channel('live-scores.'.$this->scoreboard['eventId'])];
    }

    public function broadcastAs(): string
    {
        return 'scoreboard';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return ['scoreboard' => $this->scoreboard];
    }
}
