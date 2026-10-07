<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Protest;
use App\Models\Requirement;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * GET /api/admin/transactions — the Sports Office's transaction log.
 *
 * "Sports Office transactions" are the requests the office and its coaches
 * process: CMO requirement submissions and game
 * protests. Each lives in its own module; this puts them in one list —
 * who filed what, when, its status and when it was decided — so the office
 * can track every open item in one place.
 */
class TransactionController extends Controller
{
    public const TYPES = ['cmo_requirement', 'protest'];

    public function index(Request $request)
    {
        $data = $request->validate([
            'type' => 'sometimes|nullable|in:'.implode(',', self::TYPES),
            'status' => 'sometimes|nullable|in:open,closed',
            'q' => 'sometimes|nullable|string|max:100',
            'page' => 'sometimes|integer|min:1',
            'perPage' => 'sometimes|integer|min:1|max:100',
        ]);
        $type = $data['type'] ?? null;

        $rows = collect()
            ->merge(! $type || $type === 'cmo_requirement' ? $this->requirements() : [])
            ->merge(! $type || $type === 'protest' ? $this->protests() : []);

        if (! empty($data['status'])) {
            $rows = $rows->where('open', $data['status'] === 'open');
        }
        if (! empty($data['q'])) {
            $q = mb_strtolower($data['q']);
            $rows = $rows->filter(fn ($r) => str_contains(mb_strtolower($r['party'].' '.$r['subject'].' '.$r['reference']), $q));
        }

        $rows = $rows->sortByDesc('filedAt')->values();
        $perPage = (int) ($data['perPage'] ?? 25);
        $page = (int) ($data['page'] ?? 1);

        return response()->json([
            'data' => $rows->forPage($page, $perPage)->values(),
            'total' => $rows->count(),
            'page' => $page,
            'perPage' => $perPage,
            'counts' => [
                'open' => $rows->where('open', true)->count(),
                'closed' => $rows->where('open', false)->count(),
                // Per type across every page, so a summary needn't fetch them all.
                'byType' => collect(self::TYPES)->mapWithKeys(fn ($t) => [$t => $rows->where('type', $t)->count()]),
            ],
        ]);
    }

    private function requirements(): Collection
    {
        // Only the columns the list shows: the table has ~2,000 rows with
        // descriptions, notes and file URLs this view never uses.
        return Requirement::select(['id', 'athlete_name', 'name', 'status', 'submitted_at', 'created_at', 'reviewed_at'])
            ->orderByDesc('submitted_at')->get()->map(fn (Requirement $r) => [
                'id' => $r->id,
                'type' => 'cmo_requirement',
                'reference' => 'REQ-'.strtoupper(substr($r->id, 0, 8)),
                'party' => $r->athlete_name,
                'subject' => $r->name,
                'status' => $r->status,
                'open' => $r->status === 'pending',
                'filedAt' => optional($r->submitted_at ?? $r->created_at)->toIso8601String(),
                'decidedAt' => optional($r->reviewed_at)->toIso8601String(),
                'link' => '/admin/requirements',
            ]);
    }

    private function protests(): Collection
    {
        return Protest::with('event:id,name')->orderByDesc('created_at')->get()->map(fn (Protest $p) => [
            'id' => $p->id,
            'type' => 'protest',
            'reference' => 'APL-'.strtoupper(substr($p->id, 0, 8)),
            'party' => $p->department,
            'subject' => $p->event?->name ? "Appeal: {$p->event->name}" : 'Appeal',
            'status' => $p->status,
            'open' => in_array($p->status, ['open', 'awaiting_counter'], true),
            'filedAt' => optional($p->created_at)->toIso8601String(),
            'decidedAt' => optional($p->resolved_at)->toIso8601String(),
            'link' => '/admin/protests',
        ]);
    }
}
