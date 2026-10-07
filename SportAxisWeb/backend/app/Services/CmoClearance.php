<?php

namespace App\Services;

use App\Models\Requirement;
use App\Models\RequirementType;
use Illuminate\Support\Collection;

/**
 * Whether athletes have an approved document for every active, required
 * checklist entry of their sport, worked out for many athletes in two
 * queries.
 */
class CmoClearance
{
    /**
     * @param  array<int, array{id: string, sport: ?string}>  $athletes
     * @return array<string, array{cleared: bool, required: int, approved: int, missing: array<int, string>}>
     */
    public function for(array $athletes): array
    {
        $types = RequirementType::where('active', true)->where('required', true)->orderBy('name')->get();
        $approved = Requirement::whereIn('athlete_id', array_column($athletes, 'id'))
            ->where('status', 'approved')
            ->whereNotNull('requirement_type_id')
            ->get(['athlete_id', 'requirement_type_id'])
            ->groupBy('athlete_id')
            ->map(fn (Collection $rows) => $rows->pluck('requirement_type_id')->unique());

        $out = [];
        foreach ($athletes as $a) {
            $sport = mb_strtolower(trim((string) ($a['sport'] ?? '')));
            $needed = $types->filter(fn (RequirementType $t) => $t->sport === null || mb_strtolower(trim($t->sport)) === $sport);
            $have = $approved->get($a['id'], collect());
            $missing = $needed->reject(fn (RequirementType $t) => $have->contains($t->id));
            $out[$a['id']] = [
                'cleared' => $missing->isEmpty(),
                'required' => $needed->count(),
                'approved' => $needed->count() - $missing->count(),
                'missing' => $missing->pluck('name')->values()->all(),
            ];
        }

        return $out;
    }
}
