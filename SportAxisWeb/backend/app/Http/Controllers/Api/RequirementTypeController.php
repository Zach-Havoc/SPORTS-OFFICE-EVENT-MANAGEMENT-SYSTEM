<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RequirementType;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * The eligibility checklist catalog — what documents a college/sport needs on
 * file. Any signed-in role may read it (an athlete needs the list to submit
 * against); only admin/coach may manage it.
 *
 *   GET    /api/requirement-types            (?sport=, ?includeInactive=1)
 *   POST   /api/requirement-types             admin, coach
 *   PUT    /api/requirement-types/{id}        admin, coach
 *   DELETE /api/requirement-types/{id}        admin, coach
 */
class RequirementTypeController extends Controller
{
    public function index(Request $request)
    {
        $query = RequirementType::query()->orderBy('name');

        if (! $request->boolean('includeInactive')) {
            $query->where('active', true);
        }

        if ($sport = $request->query('sport')) {
            $query->where(function ($q) use ($sport) {
                $q->whereNull('sport')->orWhereRaw('LOWER(sport) = ?', [mb_strtolower(trim((string) $sport))]);
            });
        }

        return response()->json($query->get()->map->toApiFormat());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:150',
            'description' => 'nullable|string|max:1000',
            'sport' => 'nullable|string|max:100',
            'required' => 'sometimes|boolean',
        ]);

        $type = $this->save(new RequirementType(['id' => (string) Str::uuid()]), $data, $request);

        return response()->json($type->toApiFormat(), 201);
    }

    public function update(Request $request, string $id)
    {
        $type = RequirementType::findOrFail($id);

        $data = $request->validate([
            'name' => 'sometimes|required|string|max:150',
            'description' => 'sometimes|nullable|string|max:1000',
            'sport' => 'sometimes|nullable|string|max:100',
            'required' => 'sometimes|boolean',
            'active' => 'sometimes|boolean',
        ]);

        $type = $this->save($type, $data, $request, isUpdate: true);

        return response()->json($type->toApiFormat());
    }

    public function destroy(string $id)
    {
        RequirementType::findOrFail($id)->delete();

        return response()->json(['message' => 'Requirement type deleted']);
    }

    /** Shared create/update path — one duplicate-name(+sport) message, one place. */
    private function save(RequirementType $type, array $data, Request $request, bool $isUpdate = false): RequirementType
    {
        $name = $data['name'] ?? $type->name;
        $sport = array_key_exists('sport', $data) ? $data['sport'] : $type->sport;

        $clash = RequirementType::where('name', $name)
            ->where(fn ($q) => $sport ? $q->where('sport', $sport) : $q->whereNull('sport'))
            ->when($isUpdate, fn ($q) => $q->where('id', '!=', $type->id))
            ->exists();

        if ($clash) {
            throw ValidationException::withMessages(['name' => ['That document already exists for this sport.']]);
        }

        $type->fill([
            'name' => $name,
            'description' => array_key_exists('description', $data) ? $data['description'] : $type->description,
            'sport' => $sport,
            'required' => $data['required'] ?? ($type->exists ? $type->required : true),
            'active' => $data['active'] ?? ($type->exists ? $type->active : true),
        ]);
        if (! $type->exists) {
            $type->created_by = $request->user()->id;
        }
        $type->save();

        return $type;
    }
}
