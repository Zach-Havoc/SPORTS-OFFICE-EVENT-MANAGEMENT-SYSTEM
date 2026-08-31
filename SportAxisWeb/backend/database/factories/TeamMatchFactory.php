<?php

namespace Database\Factories;

use App\Models\TeamMatch;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<TeamMatch> */
class TeamMatchFactory extends Factory
{
    protected $model = TeamMatch::class;

    public function definition(): array
    {
        $home = fake()->numberBetween(40, 100);
        $away = fake()->numberBetween(40, 100);

        return [
            'id'          => (string) Str::uuid(),
            'sport'       => 'Basketball',
            'stage'       => 'elimination',
            'event_id'    => null,
            'home_team'   => 'College of Engineering',
            'away_team'   => 'College of Business',
            'home_score'  => $home,
            'away_score'  => $away,
            'winner'      => $home === $away ? null : ($home > $away ? 'College of Engineering' : 'College of Business'),
            'is_draw'     => $home === $away,
            'status'      => 'completed',
            'played_at'   => now(),
        ];
    }

    /** A completed result with explicit teams and scores. */
    public function result(string $sport, string $home, int $homeScore, string $away, int $awayScore): static
    {
        return $this->state(fn () => [
            'sport'      => $sport,
            'home_team'  => $home,
            'away_team'  => $away,
            'home_score' => $homeScore,
            'away_score' => $awayScore,
            'winner'     => $homeScore === $awayScore ? null : ($homeScore > $awayScore ? $home : $away),
            'is_draw'    => $homeScore === $awayScore,
            'status'     => 'completed',
        ]);
    }
}
