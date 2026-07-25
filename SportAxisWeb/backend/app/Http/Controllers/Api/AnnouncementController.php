<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AnnouncementController extends Controller
{
    public function index()
    {
        $announcements = Announcement::orderByDesc('created_at')->get();
        // Ensure is_tryout is always boolean (default to true for existing records)
        $announcements->each(function ($announcement) {
            if ($announcement->is_tryout === null) {
                $announcement->is_tryout = true;
            }
        });
        return response()->json($announcements);
    }

    public function store(Request $request)
    {
        $request->validate([
            'title'    => 'required|string',
            'content'  => 'required|string',
            'isTryout' => 'boolean',
        ]);

        $user = $request->user();

        $ann = Announcement::create([
            'id'         => Str::uuid(),
            'title'      => $request->title,
            'content'    => $request->content,
            'sport'      => $request->sport,
            'coach_id'   => $user->id,
            'coach_name' => $user->name,
            'is_tryout'  => $request->has('isTryout') ? $request->isTryout : true,
        ]);

        return response()->json($ann, 201);
    }

    public function update(Request $request, string $id)
    {
        $ann = Announcement::findOrFail($id);

        // Only the coach who created it (or admin) can update
        if ($request->user()->role !== 'admin' && $ann->coach_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $data = $request->only('title', 'content', 'sport');
        if ($request->has('isTryout')) {
            $data['is_tryout'] = $request->isTryout;
        }
        $ann->update($data);
        return response()->json($ann->fresh());
    }

    public function destroy(Request $request, string $id)
    {
        $ann = Announcement::findOrFail($id);

        if ($request->user()->role !== 'admin' && $ann->coach_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $ann->delete();
        return response()->json(['message' => 'Announcement deleted']);
    }
}
