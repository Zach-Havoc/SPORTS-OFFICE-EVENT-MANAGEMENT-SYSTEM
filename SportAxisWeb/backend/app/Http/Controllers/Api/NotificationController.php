<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

/**
 * The signed-in user's in-app notifications.
 *
 *   GET  /api/notifications           { items, unreadCount }  (?unread=1 to filter)
 *   POST /api/notifications/{id}/read
 *   POST /api/notifications/read-all
 */
class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = $user->notifications();
        if ($request->boolean('unread')) {
            $query->whereNull('read_at');
        }

        $items = $query->limit((int) min($request->integer('limit', 30), 100))->get()->map(fn ($n) => [
            'id' => $n->id,
            'kind' => $n->data['kind'] ?? 'info',
            'title' => $n->data['title'] ?? 'Notification',
            'body' => $n->data['body'] ?? '',
            'url' => $n->data['url'] ?? null,
            'readAt' => $n->read_at,
            'createdAt' => $n->created_at,
        ]);

        return response()->json([
            'items' => $items,
            'unreadCount' => $user->unreadNotifications()->count(),
        ]);
    }

    public function markRead(Request $request, string $id)
    {
        $request->user()->notifications()->where('id', $id)->whereNull('read_at')->update(['read_at' => now()]);

        return response()->json(['ok' => true]);
    }

    public function markAllRead(Request $request)
    {
        // A single UPDATE for every unread row belonging to this user, instead
        // of loading the collection and issuing one UPDATE per notification.
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->json(['ok' => true]);
    }
}
