<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Athlete;
use App\Models\Category;
use App\Models\DisciplineEntry;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * The coach-owned line-up for racquet disciplines — which athlete plays a
 * college's Singles A / Singles B / Doubles slot.
 *
 *   GET    /api/discipline-entries?category=…                 (public)
 *   GET    /api/discipline-entries?parentSport=…&division=M   (public; coach → own college)
 *   POST   /api/discipline-entries                            (coach)
 *   DELETE /api/discipline-entries/{id}                       (coach)
 */
class DisciplineEntryController extends Controller
{
    public function index(Request $request)
    {
        $query = DisciplineEntry::query();

        if ($request->filled('category')) {
            $query->where('category', $request->query('category'));
        } elseif ($request->filled('parentSport')) {
            $names = Category::where('parent_sport', $request->query('parentSport'))
                ->when($request->filled('division'), fn ($q) => $q->where('division', 'like', $request->query('division').'%'))
                ->pluck('name');
            $query->whereIn('category', $names);
        }

        // A coach only ever manages their own college's line-up.
        $user = $request->user();
        if ($user && $user->role === 'coach' && $user->department) {
            $query->where('department', $user->department);
        }

        return response()->json(
            $query->orderBy('category')->orderBy('pair_slot')->get()->map($this->toApi(...))
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'category' => ['required', 'string', Rule::exists('categories', 'name')],
            'athleteId' => ['required', 'string'],
            'pairSlot' => ['nullable', Rule::in(['C', 'D'])],
        ]);

        $coach = $request->user();
        if (! $coach->department) {
            throw ValidationException::withMessages(['category' => ['Set your college first.']]);
        }

        $category = Category::where('name', $data['category'])->first();
        if (! $category || ! $category->isDiscipline()) {
            throw ValidationException::withMessages(['category' => ['Not a racquet line.']]);
        }

        [$athleteName] = $this->resolveOwnedAthlete($coach, $data['athleteId']);

        $isDoubles = $category->lineSlot() === 'CD';
        $department = $coach->department;

        if ($isDoubles) {
            if (empty($data['pairSlot'])) {
                throw ValidationException::withMessages(['pairSlot' => ['Pick C or D for the doubles pair.']]);
            }
            $entry = DisciplineEntry::firstOrNew([
                'category' => $category->name,
                'department' => $department,
                'pair_slot' => $data['pairSlot'],
            ]);
        } else {
            // Singles line — one athlete per college; re-picking swaps.
            DisciplineEntry::where('category', $category->name)
                ->where('department', $department)
                ->delete();
            $entry = new DisciplineEntry([
                'category' => $category->name,
                'department' => $department,
                'pair_slot' => null,
            ]);
        }

        if (! $entry->exists) {
            $entry->id = (string) Str::uuid();
        }
        $entry->fill([
            'athlete_id' => $data['athleteId'],
            'athlete_name' => $athleteName,
            'coach_id' => $coach->id,
        ]);
        $entry->save();

        return response()->json($this->toApi($entry), 201);
    }

    public function destroy(Request $request, string $id)
    {
        $entry = DisciplineEntry::where('id', $id)
            ->where('coach_id', $request->user()->id)
            ->firstOrFail();

        $entry->delete();

        return response()->json(['message' => 'Entry removed']);
    }

    /**
     * An athlete account can be an `athletes` row or a self-registered `users`
     * row; both are owned via `coach_id`. Returns [name, department].
     *
     * @return array{0:string,1:?string}
     */
    private function resolveOwnedAthlete(User $coach, string $athleteId): array
    {
        $athlete = Athlete::where('id', $athleteId)->where('coach_id', $coach->id)->first();
        if ($athlete) {
            return [trim("{$athlete->first_name} {$athlete->last_name}"), $athlete->department];
        }

        $user = User::where('id', $athleteId)
            ->where('coach_id', $coach->id)
            ->where('role', 'athlete')
            ->first();
        if ($user) {
            return [$user->name, $user->department];
        }

        throw ValidationException::withMessages(['athleteId' => ['Athlete is not on your roster.']]);
    }

    private function toApi(DisciplineEntry $e): array
    {
        return [
            'id' => $e->id,
            'category' => $e->category,
            'department' => $e->department,
            'athleteId' => $e->athlete_id,
            'athleteName' => $e->athlete_name,
            'pairSlot' => $e->pair_slot,
        ];
    }
}
