<?php

namespace App\Services;

use App\Models\Event;

/**
 * Which sports a coach sets a game lineup for, and what a lineup looks like
 * in each. Badminton and Table Tennis aren't here: their players are entered
 * per line (Singles A/B, Doubles) on the coach's racquet lines instead.
 *
 * A sport's `positions` are what `game_players.rotation_position` numbers
 * (1-based): volleyball's rotation I–VI, a sepak takraw regu's Tekong /
 * Feeder / Striker, chess board order. With `allOrNone`, a lineup fills
 * every position or leaves them all empty.
 */
class LineupRules
{
    /** key => rules. Checked in order, so the more specific name comes first. */
    public const SPORTS = [
        'beach volleyball' => [
            'label' => 'Beach Volleyball', 'max' => 3,
            'positionName' => null, 'positions' => [], 'allOrNone' => false,
        ],
        'volleyball' => [
            'label' => 'Volleyball', 'max' => 14,
            'positionName' => 'Starting rotation', 'positions' => ['I', 'II', 'III', 'IV', 'V', 'VI'], 'allOrNone' => true,
            'incomplete' => 'A starting rotation needs all six positions, I to VI — or leave it empty.',
        ],
        'basketball' => [
            'label' => 'Basketball', 'max' => 15,
            'positionName' => null, 'positions' => [], 'allOrNone' => false,
        ],
        'sepak takraw' => [
            'label' => 'Sepak Takraw', 'max' => 5,
            'positionName' => 'Position', 'positions' => ['Tekong', 'Feeder', 'Striker'], 'allOrNone' => true,
            'incomplete' => 'The regu needs all three positions — Tekong, Feeder and Striker — or leave them empty.',
        ],
        'chess' => [
            'label' => 'Chess', 'max' => 6,
            'positionName' => 'Board', 'positions' => ['Board 1', 'Board 2', 'Board 3', 'Board 4'], 'allOrNone' => true,
            'incomplete' => 'Board order needs all four boards — or leave it empty.',
        ],
    ];

    /** The lineup sport a game is played as, or null if it has no game lineup. */
    public static function sportOf(Event $event): ?string
    {
        $category = mb_strtolower((string) $event->category);
        foreach (array_keys(self::SPORTS) as $sport) {
            if (str_contains($category, $sport)) {
                return $sport;
            }
        }

        return null;
    }

    /** @return array{label: string, max: int, positionName: ?string, positions: array<int, string>, allOrNone: bool, incomplete?: string} */
    public static function for(string $sport): array
    {
        return self::SPORTS[$sport];
    }
}
