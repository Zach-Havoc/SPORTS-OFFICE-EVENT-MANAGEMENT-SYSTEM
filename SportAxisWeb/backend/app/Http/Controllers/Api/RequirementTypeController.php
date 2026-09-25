<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RequirementType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * The eligibility checklist catalog — what documents a college/sport needs on
 * file. Any signed-in role may read it (an athlete needs the list to submit
 * against); only admin/coach may manage it.
 *
 *   GET    /api/requirement-types                 (?sport=, ?includeInactive=1)
 *   POST   /api/requirement-types                  admin, coach
 *   PUT    /api/requirement-types/{id}              admin, coach
 *   DELETE /api/requirement-types/{id}              admin, coach
 *   POST   /api/requirement-types/{id}/template     admin, coach — attach a
 *          blank/fillable template (e.g. a Parental Consent form) the
 *          athlete downloads, signs, scans, and re-uploads as their
 *          Requirement submission against this type.
 *   DELETE /api/requirement-types/{id}/template     admin, coach
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

    /** POST /api/requirement-types/{id}/template */
    public function uploadTemplate(Request $request, string $id)
    {
        $type = RequirementType::findOrFail($id);

        $request->validate([
            // Same restriction as RequirementController::store() — document/
            // image types only, server-generated filename.
            'template' => 'required|file|max:10240|mimes:pdf,doc,docx,jpg,jpeg,png',
        ]);

        $this->deleteTemplateFile($type->template_file_url);

        $file = $request->file('template');
        $extension = strtolower($file->extension() ?: $file->getClientOriginalExtension());
        $fileName = Str::uuid().($extension ? ('.'.$extension) : '');
        $filePath = $file->storeAs('requirement_type_templates', $fileName, 'public');

        $type->update(['template_file_url' => Storage::disk('public')->url($filePath)]);

        return response()->json($type->fresh()->toApiFormat());
    }

    /** DELETE /api/requirement-types/{id}/template */
    public function deleteTemplate(string $id)
    {
        $type = RequirementType::findOrFail($id);
        $this->deleteTemplateFile($type->template_file_url);
        $type->update(['template_file_url' => null]);

        return response()->json($type->fresh()->toApiFormat());
    }

    private function deleteTemplateFile(?string $url): void
    {
        if (! $url) {
            return;
        }
        // Works for both a local "/storage/…" URL and a bucket URL that may
        // carry the bucket name in its path.
        $path = parse_url($url, PHP_URL_PATH) ?? '';
        $at = strpos($path, 'requirement_type_templates/');
        $rel = $at === false ? null : substr($path, $at);
        if ($rel) {
            Storage::disk('public')->delete($rel);
        }
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
