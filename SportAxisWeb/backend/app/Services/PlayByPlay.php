<?php

namespace App\Services;

use App\Models\Athlete;
use App\Models\Department;
use App\Models\Event;

/**
 * What every play-by-play sport shares: which sport an event is scored as,
 * the event's two teams, and how a player is named.
 *
 * Home is the event's first college, away its second, as everywhere else.
 */
class PlayByPlay
{
    /** Sports scored play-by-play on the mobile app. */
    public const SPORTS = ['basketball', 'volleyball'];

    /**
     * 'basketball' | 'volleyball' for a play-by-play sport, else null. Beach
     * volleyball isn't indoor volleyball (21-point sets, pairs, no rotation),
     * so it's scored the regular way until it gets its own rules.
     */
    public static function sportOf(Event $event): ?string
    {
        $category = mb_strtolower((string) $event->category);
        if (str_contains($category, 'beach')) {
            return null;
        }
        foreach (self::SPORTS as $sport) {
            if (str_contains($category, $sport)) {
                return $sport;
            }
        }

        return null;
    }

    /**
     * The event's two colleges as [home, away], or null if the event doesn't
     * name two colleges that exist. Matched on full name or abbreviation,
     * the same way Event::syncTaxonomyKeys does.
     *
     * @return array{0: Department, 1: Department}|null
     */
    public static function teams(Event $event): ?array
    {
        $labels = array_values($event->departments ?? []);
        if (count($labels) !== 2) {
            return null;
        }

        $all = Department::all(['id', 'name', 'abbreviation', 'logo_url']);
        $teams = array_map(fn ($label) => $all->first(fn ($d) => self::isCollege($d, $label)), $labels);

        if (! $teams[0] || ! $teams[1] || $teams[0]->id === $teams[1]->id) {
            return null;
        }

        return $teams;
    }

    /** Whether a stored college value (name or abbreviation) means this department. */
    public static function isCollege(Department $dept, ?string $value): bool
    {
        $key = fn (?string $v) => mb_strtolower(trim((string) $v));
        $v = $key($value);

        return $v !== '' && ($v === $key($dept->name) || $v === $key($dept->abbreviation));
    }

    /** An athlete's display name — from their account when linked (it owns their identity). */
    public static function nameOf(?Athlete $a): string
    {
        if (! $a) {
            return 'Unknown player';
        }
        $name = $a->account ? trim((string) $a->account->name) : trim($a->first_name.' '.$a->last_name);

        return $name !== '' ? $name : 'Unknown player';
    }
}
