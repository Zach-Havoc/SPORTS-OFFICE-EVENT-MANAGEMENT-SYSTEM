<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A single head-to-head result between two departments in a sport.
 * (Named TeamMatch, not Match — `match` is a reserved word in PHP.)
 */
class TeamMatch extends Model
{
    protected $table = 'team_matches';

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'sport', 'stage', 'event_id',
        'home_team', 'away_team', 'home_score', 'away_score',
        'winner', 'is_draw', 'status', 'played_at', 'recorded_by',
    ];

    protected $casts = [
        'home_score' => 'decimal:2',
        'away_score' => 'decimal:2',
        'is_draw'    => 'boolean',
        'played_at'  => 'datetime',
    ];

    public function event()
    {
        return $this->belongsTo(Event::class, 'event_id');
    }

    /**
     * Standings for a sport, computed from completed/forfeit matches.
     * Ordered wins ↓ → point differential ↓ → points-for ↓, with a
     * head-to-head tie-break for adjacent two-way ties. Each row carries a
     * 1-based `seed` — the number a bracket uses.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function standings(string $sport): array
    {
        $matches = self::where('sport', $sport)
            ->whereIn('status', ['completed', 'forfeit'])
            ->get();

        $rows = [];
        $touch = function (string $team) use (&$rows) {
            $rows[$team] ??= [
                'department' => $team, 'played' => 0, 'wins' => 0, 'losses' => 0,
                'draws' => 0, 'points_for' => 0.0, 'points_against' => 0.0,
            ];
        };

        foreach ($matches as $m) {
            $touch($m->home_team);
            $touch($m->away_team);

            $rows[$m->home_team]['played']++;
            $rows[$m->away_team]['played']++;
            $rows[$m->home_team]['points_for']     += (float) $m->home_score;
            $rows[$m->home_team]['points_against'] += (float) $m->away_score;
            $rows[$m->away_team]['points_for']     += (float) $m->away_score;
            $rows[$m->away_team]['points_against'] += (float) $m->home_score;

            if ($m->is_draw) {
                $rows[$m->home_team]['draws']++;
                $rows[$m->away_team]['draws']++;
            } elseif ($m->winner === $m->home_team) {
                $rows[$m->home_team]['wins']++;
                $rows[$m->away_team]['losses']++;
            } elseif ($m->winner === $m->away_team) {
                $rows[$m->away_team]['wins']++;
                $rows[$m->home_team]['losses']++;
            }
        }

        $table = collect($rows)->map(function ($r) {
            $r['point_diff'] = round($r['points_for'] - $r['points_against'], 2);
            $r['win_pct']    = $r['played'] ? round($r['wins'] / $r['played'], 3) : 0.0;

            return $r;
        })->values()->all();

        usort($table, fn ($a, $b) => [$b['wins'], $b['point_diff'], $b['points_for']]
            <=> [$a['wins'], $a['point_diff'], $a['points_for']]);

        for ($i = 0; $i < count($table) - 1; $i++) {
            $a = $table[$i];
            $b = $table[$i + 1];
            $tied = $a['wins'] === $b['wins']
                && $a['point_diff'] === $b['point_diff']
                && $a['points_for'] === $b['points_for'];
            if (! $tied) {
                continue;
            }

            $h2h = $matches->first(fn ($m) => ! $m->is_draw && (
                ($m->home_team === $a['department'] && $m->away_team === $b['department']) ||
                ($m->home_team === $b['department'] && $m->away_team === $a['department'])
            ));
            if ($h2h && $h2h->winner === $b['department']) {
                [$table[$i], $table[$i + 1]] = [$table[$i + 1], $table[$i]];
            }
        }

        foreach ($table as $i => &$row) {
            $row['seed'] = $i + 1;
        }

        return $table;
    }

    /**
     * Decide the winner from the two scores. `null` winner + is_draw=true on a tie.
     */
    public function resolveOutcome(): void
    {
        if ($this->home_score === null || $this->away_score === null) {
            $this->winner = null;
            $this->is_draw = false;

            return;
        }

        $home = (float) $this->home_score;
        $away = (float) $this->away_score;

        if (abs($home - $away) < 0.0001) {
            $this->winner = null;
            $this->is_draw = true;
        } else {
            $this->winner = $home > $away ? $this->home_team : $this->away_team;
            $this->is_draw = false;
        }
    }
}
