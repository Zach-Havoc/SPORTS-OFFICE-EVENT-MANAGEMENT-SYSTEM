<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class DepartmentController extends Controller
{
    public function index()
    {
        return response()->json(Department::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|unique:departments,name',
            'abbreviation' => 'nullable|string|max:20',
        ]);

        $dept = Department::create([
            'id' => Str::uuid(),
            'name' => $request->name,
            'abbreviation' => $request->abbreviation,
        ]);

        return response()->json($dept, 201);
    }

    public function update(Request $request, string $id)
    {
        $dept = Department::findOrFail($id);

        $request->validate([
            'name' => 'required|string|unique:departments,name,'.$id.',id',
            'abbreviation' => 'nullable|string|max:20',
        ]);

        $dept->update($request->only('name', 'abbreviation'));

        return response()->json($dept);
    }

    public function destroy(string $id)
    {
        Department::findOrFail($id)->delete();

        return response()->json(['message' => 'College deleted']);
    }

    /** POST /api/departments/{id}/logo  (multipart: logo) */
    public function uploadLogo(Request $request, string $id)
    {
        $dept = Department::findOrFail($id);
        $request->validate(['logo' => 'required|file|image|max:4096']);

        $stored = $this->storeLogo($request->file('logo'));
        if (! $stored) {
            return response()->json(['error' => 'That file is not a valid image.'], 422);
        }

        $this->deleteLogoFile($dept->logo_url);
        $dept->update(['logo_url' => asset('storage/'.$stored)]);

        return response()->json($dept->fresh());
    }

    /** DELETE /api/departments/{id}/logo */
    public function deleteLogo(string $id)
    {
        $dept = Department::findOrFail($id);
        $this->deleteLogoFile($dept->logo_url);
        $dept->update(['logo_url' => null]);

        return response()->json($dept->fresh());
    }

    /**
     * Re-check the bytes are a real raster image before writing to the public
     * disk, so no HTML/SVG/script payload can be served from our origin.
     */
    private function storeLogo(UploadedFile $file): ?string
    {
        $info = @getimagesizefromstring((string) file_get_contents($file->getRealPath()));
        $allowed = [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP, IMAGETYPE_GIF];
        if ($info === false || ! in_array($info[2] ?? null, $allowed, true)) {
            return null;
        }

        $ext = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: 'png');
        $name = 'department_logos/'.Str::uuid().'.'.$ext;
        Storage::disk('public')->put($name, file_get_contents($file->getRealPath()));

        return $name;
    }

    private function deleteLogoFile(?string $url): void
    {
        if (! $url) {
            return;
        }
        $rel = ltrim(parse_url($url, PHP_URL_PATH) ?? '', '/');
        $rel = preg_replace('#^storage/#', '', $rel);
        if ($rel && str_starts_with($rel, 'department_logos/')) {
            Storage::disk('public')->delete($rel);
        }
    }
}
