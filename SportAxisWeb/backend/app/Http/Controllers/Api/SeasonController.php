<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Season;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Tournament editions.
 *
 *   GET    /api/seasons            (public) every edition, active first
 *   GET    /api/seasons/current    (public) the active edition, or null
 *   POST   /api/seasons            (admin)  create
 *   PUT    /api/seasons/{id}       (admin)  rename / re-date
 *   POST   /api/seasons/{id}/activate (admin) make it the one active edition
 *   DELETE /api/seasons/{id}       (admin)  only when empty and not active
 */
class SeasonController extends Controller
{
    public function index()
    {
        return response()->json(
            Season::orderByDesc('is_active')->orderByDesc('created_at')->get()->map->toApiFormat()
        );
    }

    public function current()
    {
        return response()->json(Season::current()?->toApiFormat());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:120|unique:seasons,name',
            'startsOn' => 'nullable|date',
            'endsOn' => 'nullable|date|after_or_equal:startsOn',
            'activate' => 'sometimes|boolean',
        ]);

        $season = Season::create([
            'id' => (string) Str::uuid(),
            'name' => $data['name'],
            'starts_on' => $data['startsOn'] ?? null,
            'ends_on' => $data['endsOn'] ?? null,
            'is_active' => false,
        ]);

        // The very first season, or an explicit request, becomes active.
        if (($data['activate'] ?? false) || Season::count() === 1) {
            $this->makeActive($season);
        }

        return response()->json($season->fresh()->toApiFormat(), 201);
    }

    public function update(Request $request, string $id)
    {
        $season = Season::findOrFail($id);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120', Rule::unique('seasons', 'name')->ignore($id)],
            'startsOn' => 'sometimes|nullable|date',
            'endsOn' => 'sometimes|nullable|date|after_or_equal:startsOn',
        ]);

        if (array_key_exists('name', $data)) {
            $season->name = $data['name'];
        }
        if (array_key_exists('startsOn', $data)) {
            $season->starts_on = $data['startsOn'];
        }
        if (array_key_exists('endsOn', $data)) {
            $season->ends_on = $data['endsOn'];
        }
        $season->save();

        return response()->json($season->fresh()->toApiFormat());
    }

    public function activate(string $id)
    {
        $season = Season::findOrFail($id);
        $this->makeActive($season);

        return response()->json($season->fresh()->toApiFormat());
    }

    public function destroy(string $id)
    {
        $season = Season::findOrFail($id);

        if ($season->is_active) {
            return response()->json(
                ['error' => 'The active season cannot be deleted. Activate another one first.'],
                422,
            );
        }

        if ($season->events()->withTrashed()->exists() || $season->brackets()->withTrashed()->exists()) {
            return response()->json(
                ['error' => 'This season has events or brackets and cannot be deleted.'],
                409,
            );
        }

        $season->delete();

        return response()->json(['message' => 'Season deleted']);
    }

    /** Flip the active flag so exactly one season carries it. */
    private function makeActive(Season $season): void
    {
        DB::transaction(function () use ($season) {
            Season::where('id', '!=', $season->id)
                ->where('is_active', true)
                ->update(['is_active' => false]);

            $season->update(['is_active' => true]);
        });
    }
}
