<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\Protest;
use App\Models\User;
use App\Notifications\ProtestFiled;
use App\Notifications\ProtestResolved;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

/**
 * Formal complaints about event outcomes.
 *
 *   GET  /api/protests            admin: all (optionally ?status= / ?season=);
 *                                 coach: their own college's
 *   POST /api/protests            coach files one for a game their team played
 *   POST /api/protests/{id}/resolve  admin upholds or dismisses, with a note
 */
class ProtestController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Protest::query()->with(['event', 'filer', 'resolver'])->latest();

        if ($user->role === 'coach') {
            $query->where(function ($q) use ($user) {
                $q->where('filed_by', $user->id);
                if ($user->department) {
                    $q->orWhere('department', $user->department);
                }
            });
        } else {
            $query->when($request->query('status'), fn ($q, $s) => $q->where('status', $s))
                ->when($request->query('season'), fn ($q, $s) => $q->where('season_id', $s));
        }

        return response()->json($query->get()->map->toApiFormat());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'eventId' => 'required|string|exists:events,id',
            'reason' => 'required|string|min:15|max:2000',
        ]);

        $user = $request->user();
        $event = Event::findOrFail($data['eventId']);

        $protest = Protest::create([
            'id' => (string) Str::uuid(),
            'event_id' => $event->id,
            'season_id' => $event->season_id,
            'filed_by' => $user->id,
            'department' => $user->department ?: 'Unknown',
            'reason' => $data['reason'],
            'status' => 'open',
        ]);

        Notification::send(
            User::where('role', 'admin')->where('active', true)->get(),
            new ProtestFiled($protest->fresh('event')),
        );

        return response()->json($protest->fresh(['event', 'filer'])->toApiFormat(), 201);
    }

    public function resolve(Request $request, string $id)
    {
        $data = $request->validate([
            'status' => 'required|in:upheld,dismissed',
            'resolution' => 'required|string|min:10|max:2000',
        ]);

        $protest = Protest::findOrFail($id);
        $protest->update([
            'status' => $data['status'],
            'resolution' => $data['resolution'],
            'resolved_by' => $request->user()->id,
            'resolved_at' => now(),
        ]);

        $protest->loadMissing(['event', 'filer']);
        $protest->filer?->notify(new ProtestResolved($protest));

        return response()->json($protest->fresh(['event', 'filer', 'resolver'])->toApiFormat());
    }
}
