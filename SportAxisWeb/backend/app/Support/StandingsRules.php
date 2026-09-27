<?php

namespace App\Support;

use App\Models\AppSetting;

/**
 * How the college standings are ranked — the admin picks it in Settings →
 * Standings:
 *
 *   olympic  most golds, then silvers, then bronzes; no points
 *   points   Gold 10, Silver 7, Bronze 5 — ranked by points, then golds
 *   custom   the office's own points per medal, ranked the same way
 */
class StandingsRules
{
    public const KEY = 'standings_rules';

    public const METHODS = ['olympic', 'points', 'custom'];

    public const DEFAULT_POINTS = ['gold' => 10, 'silver' => 7, 'bronze' => 5];

    /** @return array{method: string, points: array{gold: int, silver: int, bronze: int}, customPoints: array{gold: int, silver: int, bronze: int}} */
    public static function current(): array
    {
        $saved = (array) AppSetting::read(self::KEY, []);
        $method = in_array($saved['method'] ?? null, self::METHODS, true) ? $saved['method'] : 'points';
        $custom = array_map('intval', array_merge(self::DEFAULT_POINTS, array_intersect_key((array) ($saved['customPoints'] ?? []), self::DEFAULT_POINTS)));

        return [
            'method' => $method,
            'points' => $method === 'custom' ? $custom : self::DEFAULT_POINTS,
            'customPoints' => $custom,
        ];
    }

    /** A college's points from its medals, or null when the standings don't use points. */
    public static function pointsFor(array $row, ?array $rules = null): ?int
    {
        $rules ??= self::current();
        if ($rules['method'] === 'olympic') {
            return null;
        }
        $p = $rules['points'];

        return $p['gold'] * (int) $row['gold'] + $p['silver'] * (int) $row['silver'] + $p['bronze'] * (int) $row['bronze'];
    }

    /** Best first. Judged-sport score totals only ever break a tie. */
    public static function sort(array $rows, ?array $rules = null): array
    {
        $rules ??= self::current();
        usort($rows, function ($a, $b) use ($rules) {
            $key = fn ($r) => $rules['method'] === 'olympic'
                ? [$r['gold'], $r['silver'], $r['bronze'], $r['total']]
                : [$r['points'], $r['gold'], $r['silver'], $r['bronze'], $r['total']];

            return $key($b) <=> $key($a);
        });

        return $rows;
    }

    /** Changes whenever the rules do — part of the leaderboard's cache key. */
    public static function fingerprint(): string
    {
        $r = self::current();

        return $r['method'].'-'.implode('-', $r['points']);
    }
}
