<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ranking;
use App\Models\Score;
use App\Models\Event;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RankingController extends Controller
{
    public function show(string $eventId)
    {
        $rankings = Ranking::where('event_id', $eventId)->orderBy('rank')->get();
        return response()->json($rankings);
    }

    public function leaderboard(Request $request)
    {
        $category = $request->query('category');

        $query = Event::query();
        if ($category) {
            $query->where('category', $category);
        }
        $eventIds = $query->pluck('id');

        // rankings.department stores the array index into events.departments JSON array
        // Resolve to a human-readable name via JSON_EXTRACT
        $leaderboard = DB::table('rankings')
            ->join('events', 'events.id', '=', 'rankings.event_id')
            ->whereIn('rankings.event_id', $eventIds)
            ->selectRaw('
                JSON_UNQUOTE(JSON_EXTRACT(events.departments, CONCAT("$[", rankings.department, "]"))) as department_name,
                SUM(rankings.total_score) as total,
                COUNT(rankings.event_id) as event_count
            ')
            ->groupBy('department_name')
            ->orderByDesc('total')
            ->get()
            ->map(fn($row) => [
                'department' => $row->department_name,
                'total'      => $row->total,
                'event_count'=> $row->event_count,
            ]);

        return response()->json($leaderboard);
    }
}
