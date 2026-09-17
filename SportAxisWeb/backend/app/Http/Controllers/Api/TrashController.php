<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Athlete;
use App\Models\Bracket;
use App\Models\Event;
use App\Models\Score;

/**
 * The recycle bin: soft-deleted rows across the tables that support recovery.
 * Admin only. Restore is done through each resource's own
 * `POST /{resource}/{id}/restore` endpoint.
 */
class TrashController extends Controller
{
    private const LIMIT = 100;

    public function index()
    {
        return response()->json([
            'events' => Event::onlyTrashed()
                ->orderByDesc('deleted_at')->limit(self::LIMIT)->get()
                ->map(fn (Event $e) => [
                    'id' => $e->id,
                    'label' => $e->name,
                    'detail' => trim(($e->category ?? '').' · '.($e->schedule ?? '')),
                    'deletedAt' => $e->deleted_at,
                ]),

            'scores' => Score::onlyTrashed()
                ->orderByDesc('deleted_at')->limit(self::LIMIT)->get()
                ->map(fn (Score $s) => [
                    'id' => $s->id,
                    'label' => $s->department.' — '.$s->total_score,
                    'detail' => 'by '.$s->judge_name,
                    'eventId' => $s->event_id,
                    'deletedAt' => $s->deleted_at,
                ]),

            'athletes' => Athlete::onlyTrashed()
                ->orderByDesc('deleted_at')->limit(self::LIMIT)->get()
                ->map(fn (Athlete $a) => [
                    'id' => $a->id,
                    'label' => trim($a->first_name.' '.$a->last_name),
                    'detail' => trim(($a->sport ?? '').' · '.($a->department ?? '')),
                    'deletedAt' => $a->deleted_at,
                ]),

            'brackets' => Bracket::onlyTrashed()
                ->orderByDesc('deleted_at')->limit(self::LIMIT)->get()
                ->map(fn (Bracket $b) => [
                    'id' => $b->id,
                    'label' => $b->name,
                    'detail' => trim(($b->sport ?? '').' · '.$b->format),
                    'deletedAt' => $b->deleted_at,
                ]),

            'announcements' => Announcement::onlyTrashed()
                ->orderByDesc('deleted_at')->limit(self::LIMIT)->get()
                ->map(fn (Announcement $n) => [
                    'id' => $n->id,
                    'label' => $n->title,
                    'detail' => 'by '.$n->coach_name,
                    'deletedAt' => $n->deleted_at,
                ]),
        ]);
    }
}
