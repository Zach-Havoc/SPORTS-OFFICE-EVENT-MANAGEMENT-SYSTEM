<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Athlete;
use App\Models\AuditLog;
use App\Models\Bracket;
use App\Models\Event;
use App\Models\Requirement;
use App\Models\Score;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Read access to the audit trail. Admin only. Filterable by the record it
 * concerns, the acting user, or the kind of change; paged newest-first with a
 * simple id cursor.
 */
class AuditLogController extends Controller
{
    /** Model basename -> fully-qualified class, for the `type` filter. */
    private const TYPES = [
        'Score' => Score::class,
        'Event' => Event::class,
        'Athlete' => Athlete::class,
        'Bracket' => Bracket::class,
        'Announcement' => Announcement::class,
        'User' => User::class,
        'Requirement' => Requirement::class,
    ];

    public function index(Request $request)
    {
        $data = $request->validate([
            'type' => ['nullable', 'string', 'in:'.implode(',', array_keys(self::TYPES))],
            'id' => ['nullable', 'string'],
            'userId' => ['nullable', 'string'],
            'event' => ['nullable', 'string', 'max:30'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
            'before' => ['nullable', 'integer', 'min:1'],
        ]);

        $limit = (int) ($data['limit'] ?? 50);

        $query = AuditLog::query()
            ->when($data['type'] ?? null, fn ($q, $t) => $q->where('auditable_type', self::TYPES[$t]))
            ->when($data['id'] ?? null, fn ($q, $id) => $q->where('auditable_id', $id))
            ->when($data['userId'] ?? null, fn ($q, $uid) => $q->where('user_id', $uid))
            ->when($data['event'] ?? null, fn ($q, $e) => $q->where('event', $e))
            ->when($data['before'] ?? null, fn ($q, $b) => $q->where('id', '<', $b))
            ->orderByDesc('id')
            ->limit($limit + 1)
            ->get();

        $hasMore = $query->count() > $limit;
        $rows = $query->take($limit);

        return response()->json([
            'logs' => $rows->map->toApiFormat()->values(),
            'nextCursor' => $hasMore ? $rows->last()->id : null,
        ]);
    }
}
