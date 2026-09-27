<?php

namespace App\Services;

use App\Models\Department;
use App\Models\User;

/**
 * Intramurals are college-based: an athlete can only join their own
 * college's team. A coach's team is (their college) × (their sport), so a
 * CICS student can't join CABEIHM's Basketball team.
 *
 * Every way onto a team goes through `joinError()`: enrolling with a coach's
 * code, a tryout application (and its acceptance), and a coach adding an
 * athlete. Colleges are compared by record, so "CICS" and "College of
 * Informatics and Computing Sciences" are the same college.
 */
class TeamMembership
{
    /** The college a stored value names (full name or abbreviation), or null. */
    public static function college(?string $value): ?Department
    {
        $key = mb_strtolower(trim((string) $value));
        if ($key === '') {
            return null;
        }

        return Department::whereRaw('LOWER(name) = ?', [$key])
            ->orWhereRaw('LOWER(abbreviation) = ?', [$key])
            ->first();
    }

    public static function coachCollege(User $coach): ?Department
    {
        return $coach->departmentRow ?? self::college($coach->department);
    }

    /**
     * Why an athlete from `$athleteCollege` can't join `$coach`'s team, or
     * null if they can. Nothing is compared when either side has no college
     * yet — enrolment handles those itself (the athlete takes the coach's).
     * `$toCoach` words it for the coach adding the athlete.
     */
    public static function joinError(User $coach, ?string $athleteCollege, bool $toCoach = false): ?string
    {
        $teamKeys = self::keys($coach->department, self::coachCollege($coach));
        $athleteKeys = self::keys($athleteCollege, self::college($athleteCollege));
        if (! $teamKeys || ! $athleteKeys || array_intersect($teamKeys, $athleteKeys)) {
            return null;
        }

        $team = self::coachCollege($coach);
        $mine = self::college($athleteCollege);
        $teamName = $team ? ($team->abbreviation ?: $team->name) : trim((string) $coach->department);
        $yours = $mine ? ($mine->abbreviation ?: $mine->name) : trim((string) $athleteCollege);
        $sport = $coach->sport ? "{$coach->sport} " : '';

        return $toCoach
            ? "This athlete can't join your team. They're from {$yours}, and yours is {$teamName}'s {$sport}team. "
                .'Athletes can only join their own college\'s team.'
            : "You can't join this team. It's {$teamName}'s {$sport}team, and you're from {$yours}. "
                .'Athletes can only join their own college\'s team.';
    }

    /**
     * Every spelling a college goes by: the stored value, plus the record's
     * name and abbreviation when it matches one. Empty when there's no college.
     *
     * @return array<int, string>
     */
    private static function keys(?string $value, ?Department $record): array
    {
        return array_values(array_unique(array_filter(array_map(
            fn ($v) => mb_strtolower(trim((string) $v)),
            [$value, $record?->name, $record?->abbreviation],
        ))));
    }
}
