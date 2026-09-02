<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SiteSlide;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Admin-managed public imagery.
 *
 *  Public:
 *    GET  /api/site-slides?type=carousel|popup   active slides, ordered
 *
 *  Admin (role:admin):
 *    GET    /api/admin/site-slides?type=...       every slide incl. hidden
 *    POST   /api/admin/site-slides                upload a new slide
 *    PUT    /api/admin/site-slides/{id}           update (optionally replace image)
 *    DELETE /api/admin/site-slides/{id}           remove slide + its file
 *    POST   /api/admin/site-slides/reorder        set the display order
 */
class SiteSlideController extends Controller
{
    private const TYPES = ['carousel', 'popup'];

    // ── Public ──────────────────────────────────────────────────────────

    /** GET /api/site-slides?type=carousel|popup */
    public function publicIndex(Request $request)
    {
        $type = in_array($request->query('type'), self::TYPES, true)
            ? $request->query('type')
            : 'carousel';

        $slides = SiteSlide::where('type', $type)
            ->where('active', true)
            ->orderBy('sort_order')
            ->orderBy('created_at')
            ->get();

        return response()->json($slides->map->toApiFormat());
    }

    // ── Admin ───────────────────────────────────────────────────────────

    /** GET /api/admin/site-slides?type=... */
    public function index(Request $request)
    {
        $query = SiteSlide::query()->orderBy('type')->orderBy('sort_order')->orderBy('created_at');

        if (in_array($request->query('type'), self::TYPES, true)) {
            $query->where('type', $request->query('type'));
        }

        return response()->json($query->get()->map->toApiFormat());
    }

    /** POST /api/admin/site-slides */
    public function store(Request $request)
    {
        $data = $request->validate([
            'type'    => ['required', Rule::in(self::TYPES)],
            'title'   => 'nullable|string|max:255',
            'caption' => 'nullable|string|max:2000',
            'linkUrl' => 'nullable|url|max:2000',
            'active'  => 'sometimes|boolean',
            // Images only — never let arbitrary/script content onto the public disk.
            'image'   => 'required|file|image|mimes:jpg,jpeg,png,webp|max:5120',
        ]);

        $path = $this->storeImage($request->file('image'));
        if (! $path) {
            return response()->json(['error' => 'The uploaded file is not a valid image.'], 422);
        }

        $slide = SiteSlide::create([
            'id'         => (string) Str::uuid(),
            'type'       => $data['type'],
            'title'      => $data['title'] ?? null,
            'caption'    => $data['caption'] ?? null,
            'image_path' => $path,
            'link_url'   => $data['linkUrl'] ?? null,
            'sort_order' => (int) SiteSlide::where('type', $data['type'])->max('sort_order') + 1,
            'active'     => $request->boolean('active', true),
            'created_by' => $request->user()->id,
        ]);

        return response()->json($slide->toApiFormat(), 201);
    }

    /** PUT /api/admin/site-slides/{id}  (send as POST + _method=PUT to carry a file) */
    public function update(Request $request, string $id)
    {
        $slide = SiteSlide::findOrFail($id);

        $data = $request->validate([
            'title'     => 'sometimes|nullable|string|max:255',
            'caption'   => 'sometimes|nullable|string|max:2000',
            'linkUrl'   => 'sometimes|nullable|url|max:2000',
            'active'    => 'sometimes|boolean',
            'sortOrder' => 'sometimes|integer|min:0',
            'image'     => 'sometimes|file|image|mimes:jpg,jpeg,png,webp|max:5120',
        ]);

        if ($request->hasFile('image')) {
            $path = $this->storeImage($request->file('image'));
            if (! $path) {
                return response()->json(['error' => 'The uploaded file is not a valid image.'], 422);
            }
            Storage::disk('public')->delete($slide->image_path); // drop the old file
            $slide->image_path = $path;
        }

        foreach ([
            'title'     => 'title',
            'caption'   => 'caption',
            'linkUrl'   => 'link_url',
            'sortOrder' => 'sort_order',
        ] as $input => $column) {
            if ($request->exists($input)) {
                $slide->{$column} = $data[$input] ?? null;
            }
        }

        if ($request->exists('active')) {
            $slide->active = $request->boolean('active');
        }

        $slide->save();

        return response()->json($slide->toApiFormat());
    }

    /** DELETE /api/admin/site-slides/{id} */
    public function destroy(string $id)
    {
        $slide = SiteSlide::findOrFail($id);
        Storage::disk('public')->delete($slide->image_path);
        $slide->delete();

        return response()->json(['message' => 'Slide deleted']);
    }

    /** POST /api/admin/site-slides/reorder  { type, order: [id, id, ...] } */
    public function reorder(Request $request)
    {
        $data = $request->validate([
            'type'    => ['required', Rule::in(self::TYPES)],
            'order'   => 'required|array',
            'order.*' => 'string',
        ]);

        foreach (array_values($data['order']) as $position => $slideId) {
            SiteSlide::where('id', $slideId)
                ->where('type', $data['type'])
                ->update(['sort_order' => $position]);
        }

        return response()->json(['message' => 'Order updated']);
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    /**
     * Store an uploaded image under a random name on the public disk.
     * Re-checks the real bytes (not just the client MIME) so nothing but a
     * genuine raster image can ever land in a web-served folder.
     *
     * @return string|null relative path, or null if the bytes are not an image
     */
    private function storeImage(\Illuminate\Http\UploadedFile $file): ?string
    {
        $info = @getimagesizefromstring((string) file_get_contents($file->getRealPath()));
        $allowed = [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP];

        if ($info === false || ! in_array($info[2] ?? null, $allowed, true)) {
            return null;
        }

        $ext = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: 'jpg');
        $name = 'site_slides/' . Str::uuid() . '.' . $ext;

        Storage::disk('public')->put($name, file_get_contents($file->getRealPath()));

        return $name;
    }
}
