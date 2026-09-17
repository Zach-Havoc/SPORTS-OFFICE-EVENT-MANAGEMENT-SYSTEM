<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Athlete;
use App\Models\Category;
use App\Models\Event;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * GET /api/athlete/schedule   — the signed-in athlete's own fixtures
 * GET /api/coach/schedule     — the signed-in coach's fixtures
 *
 * Both answer the same question — which games does my college play in my
 * sport — and both resolve it by key, never by comparing college or sport
 * text: the college through `event_department`, the sport through
 * `events.category_id` plus any racquet discipline whose `parent_id` is that
 * sport. The only difference is that an athlete has one rostered sport while
 * a coach can handle several.
 */
class TeamScheduleController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $departmentId = $user->department_id;
        $sports = $user->role === 'coach'
            ? $user->sportCategories()->get(['categories.id', 'categories.name'])
            : $this->athleteSport($user);

        // Nothing to match on — name which half is missing so the page can tell
        // the user what to fix instead of showing a bare empty list.
        if (! $departmentId || $sports->isEmpty()) {
            return response()->json([
                'team' => null,
                'reason' => ! $departmentId ? 'no_college' : 'no_sport',
                'events' => [],
            ]);
        }

        $events = $this->games($departmentId, $sports->pluck('id'));
        $college = $user->departmentRow;

        return response()->json([
            'team' => [
                'college' => $college?->name,
                'collegeAbbreviation' => $college?->abbreviation,
                'sports' => $sports->pluck('name')->values(),
            ],
            'reason' => $events->isEmpty() ? 'no_games' : null,
            'events' => $events->map(fn (Event $e) => array_merge($e->toApiFormat(), [
                'opponents' => $e->departmentRows
                    ->reject(fn ($d) => $d->id === $departmentId)
                    ->map(fn ($d) => ['name' => $d->name, 'abbreviation' => $d->abbreviation])
                    ->values(),
            ])),
        ]);
    }

    /** The single sport an athlete is rostered for, as a collection of 0 or 1. */
    private function athleteSport(User $user): Collection
    {
        $categoryId = Athlete::where('user_id', $user->id)->value('category_id');

        return $categoryId
            ? Category::where('id', $categoryId)->get(['id', 'name'])
            : collect();
    }

    /** Games this college contests in any of these sports (disciplines included). */
    private function games(string $departmentId, Collection $sportIds): Collection
    {
        $categoryIds = Category::whereIn('id', $sportIds)
            ->orWhereIn('parent_id', $sportIds)
            ->pluck('id');

        return Event::query()
            ->whereIn('category_id', $categoryIds)
            ->whereHas('departmentRows', fn ($q) => $q->where('departments.id', $departmentId))
            ->with('departmentRows:id,name,abbreviation')
            ->orderBy('schedule')
            ->orderBy('start_time')
            ->get();
    }
}
