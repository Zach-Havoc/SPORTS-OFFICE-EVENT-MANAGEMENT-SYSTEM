<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CmoSubmission;
use App\Models\Protest;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * GET /api/admin/transactions — the Sports Office's transaction log.
 *
 * "Sports Office transactions" are the requests the office and its coaches
 * process: CMO submissions from coaches and game
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

    /**
     * CMO submissions: the batches of cleared athletes coaches forward to the
     * office. Open while any athlete in the batch waits for the office's
     * decision. (A document waiting on its coach's review isn't the office's.)
     */
    private function requirements(): Collection
    {
        return CmoSubmission::withCount([
            'athletes',
            'athletes as waiting_count' => fn ($q) => $q->where('status', 'submitted'),
            'athletes as returned_count' => fn ($q) => $q->where('status', 'returned'),
        ])->with('athletes:id,submission_id,reviewed_at')
            ->orderByDesc('submitted_at')->get()->map(fn (CmoSubmission $s) => [
                'id' => $s->id,
                'type' => 'cmo_requirement',
                'reference' => 'CMO-'.strtoupper(substr($s->id, 0, 8)),
                'party' => $s->department,
                'subject' => trim(($s->sport ? "{$s->sport} · " : '').$s->athletes_count.' '.($s->athletes_count === 1 ? 'athlete' : 'athletes')),
                'status' => $s->waiting_count > 0 ? 'pending' : ($s->returned_count > 0 ? 'returned' : 'accepted'),
                'open' => $s->waiting_count > 0,
                'filedAt' => optional($s->submitted_at)->toIso8601String(),
                'decidedAt' => $s->waiting_count > 0 ? null : optional($s->athletes->max('reviewed_at'))->toIso8601String(),
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
