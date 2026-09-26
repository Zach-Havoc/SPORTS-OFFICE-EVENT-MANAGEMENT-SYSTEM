<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Protest;
use App\Models\Requirement;
use App\Models\TryoutApplication;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * GET /api/admin/transactions — the Sports Office's transaction log.
 *
 * "Sports Office transactions" are the requests the office and its coaches
 * process: CMO requirement submissions, tryout applications and game
 * protests. Each lives in its own module; this puts them in one list —
 * who filed what, when, its status and when it was decided — so the office
 * can track every open item in one place.
 */
class TransactionController extends Controller
{
    public const TYPES = ['cmo_requirement', 'tryout_application', 'protest'];

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
            ->merge(! $type || $type === 'tryout_application' ? $this->tryouts() : [])
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
            ],
        ]);
    }

    private function requirements(): Collection
    {
        return Requirement::orderByDesc('submitted_at')->get()->map(fn (Requirement $r) => [
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

    private function tryouts(): Collection
    {
        return TryoutApplication::orderByDesc('applied_at')->get()->map(fn (TryoutApplication $t) => [
            'id' => $t->id,
            'type' => 'tryout_application',
            'reference' => 'TRY-'.strtoupper(substr($t->id, 0, 8)),
            'party' => trim("{$t->first_name} {$t->last_name}"),
            'subject' => trim(($t->sport ? "{$t->sport} tryout" : 'Tryout').' · '.$t->department, ' ·'),
            'status' => $t->status,
            'open' => $t->status === 'pending',
            'filedAt' => optional($t->applied_at ?? $t->created_at)->toIso8601String(),
            'decidedAt' => optional($t->reviewed_at)->toIso8601String(),
            'link' => '/admin/tryouts',
        ]);
    }

    private function protests(): Collection
    {
        return Protest::with('event:id,name')->orderByDesc('created_at')->get()->map(fn (Protest $p) => [
            'id' => $p->id,
            'type' => 'protest',
            'reference' => 'PRT-'.strtoupper(substr($p->id, 0, 8)),
            'party' => $p->department,
            'subject' => $p->event?->name ? "Protest: {$p->event->name}" : 'Protest',
            'status' => $p->status,
            'open' => $p->status === 'open',
            'filedAt' => optional($p->created_at)->toIso8601String(),
            'decidedAt' => optional($p->resolved_at)->toIso8601String(),
            'link' => '/admin/protests',
        ]);
    }
}
