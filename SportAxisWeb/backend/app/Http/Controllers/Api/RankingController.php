<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ranking;
use App\Models\Score;
use App\Models\Event;
use App\Models\Department;
use Illuminate\Http\Request;

class RankingController extends Controller
{
    public function show(string $eventId)
    {
        if (Ranking::where('event_id', $eventId)->count() === 0 && Score::where('event_id', $eventId)->exists()) {
            ScoreController::recalculateRankings($eventId);
        }

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

        // Recalculate rankings for any events that have scores
        $eventsWithScores = Score::whereIn('event_id', $eventIds)->pluck('event_id')->unique();
        foreach ($eventsWithScores as $eId) {
            ScoreController::recalculateRankings($eId);
        }

        // Fetch rankings for the matching events
        $rankings = Ranking::whereIn('event_id', $eventIds)->get();
        $grouped = $rankings->groupBy('department');

        // Initialize with all registered departments
        $allDepartments = Department::pluck('name')->toArray();
        $resultMap = [];

        foreach ($allDepartments as $deptName) {
            $resultMap[$deptName] = [
                'department' => $deptName,
                'total'      => 0,
                'event_count'=> 0,
                'gold'       => 0,
                'silver'     => 0,
                'bronze'     => 0,
            ];
        }

        foreach ($grouped as $deptName => $deptRankings) {
            if (!$deptName) continue;

            if (!isset($resultMap[$deptName])) {
                $resultMap[$deptName] = [
                    'department' => $deptName,
                    'total'      => 0,
                    'event_count'=> 0,
                    'gold'       => 0,
                    'silver'     => 0,
                    'bronze'     => 0,
                ];
            }

            $resultMap[$deptName]['total'] = (float) $deptRankings->sum('total_score');
            $resultMap[$deptName]['event_count'] = $deptRankings->pluck('event_id')->unique()->count();
            $resultMap[$deptName]['gold'] = $deptRankings->where('rank', 1)->count();
            $resultMap[$deptName]['silver'] = $deptRankings->where('rank', 2)->count();
            $resultMap[$deptName]['bronze'] = $deptRankings->where('rank', 3)->count();
        }

        $leaderboard = array_values($resultMap);
        usort($leaderboard, function ($a, $b) {
            if ($b['total'] != $a['total']) {
                return $b['total'] <=> $a['total'];
            }
            if ($b['gold'] != $a['gold']) {
                return $b['gold'] <=> $a['gold'];
            }
            if ($b['silver'] != $a['silver']) {
                return $b['silver'] <=> $a['silver'];
            }
            return $b['bronze'] <=> $a['bronze'];
        });

        return response()->json($leaderboard);
    }
}
