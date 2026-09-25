<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\Paginates;
use App\Http\Controllers\Controller;
use App\Models\Athlete;
use App\Models\Requirement;
use App\Models\RequirementType;
use App\Models\User;
use App\Notifications\RequirementReviewed;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class RequirementController extends Controller
{
    use Paginates;

    public function index(Request $request)
    {
        $user = $request->user();
        $perPage = $this->perPage($request, 50);

        if ($user->role === 'coach') {
            $athleteIds = Athlete::where('coach_id', $user->id)->pluck('id');
            $userIds = User::where('coach_id', $user->id)->pluck('id');
            $rosterIds = $athleteIds->merge($userIds)->unique();

            return response()->json(
                Requirement::whereIn('athlete_id', $rosterIds)->orderByDesc('submitted_at')->paginate($perPage)
            );
        }

        return response()->json(Requirement::orderByDesc('submitted_at')->paginate($perPage));
    }

    public function myRequirements(Request $request)
    {
        $athleteId = $this->athleteIdFor($request->user());

        return response()->json(
            Requirement::where('athlete_id', $athleteId)->orderByDesc('submitted_at')->get()
        );
    }

    /**
     * GET /api/requirements/my/clearance — whether the athlete has an approved
     * submission against every active, required checklist entry for their
     * sport, and which ones are still missing.
     */
    public function clearance(Request $request)
    {
        $user = $request->user();
        $athlete = $this->athleteFor($user);
        $athleteId = $athlete?->id ?? $user->id;
        $sport = $athlete?->sport ?? $user->sport;

        $required = RequirementType::where('active', true)->where('required', true)
            ->where(function ($q) use ($sport) {
                $q->whereNull('sport');
                if ($sport) {
                    $q->orWhereRaw('LOWER(sport) = ?', [mb_strtolower(trim((string) $sport))]);
                }
            })
            ->orderBy('name')
            ->get();

        $approvedTypeIds = Requirement::where('athlete_id', $athleteId)
            ->where('status', 'approved')
            ->whereNotNull('requirement_type_id')
            ->pluck('requirement_type_id');

        $missing = $required->reject(fn (RequirementType $t) => $approvedTypeIds->contains($t->id))->values();

        return response()->json([
            'cleared' => $missing->isEmpty(),
            'requiredCount' => $required->count(),
            'approvedCount' => $required->count() - $missing->count(),
            'missing' => $missing->map->toApiFormat()->values(),
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'type' => 'required|string|max:255',
            'requirementTypeId' => 'sometimes|nullable|string|exists:requirement_types,id',
            'supersedesId' => 'sometimes|nullable|string|exists:requirements,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:2000',
            // Restrict to document / image types only. Without this an
            // attacker could upload .php / .html / .svg to the public disk
            // and get stored XSS or code execution.
            'file' => 'required|file|max:10240|mimes:pdf,doc,docx,jpg,jpeg,png',
        ]);

        $user = $request->user();
        $athlete = $this->athleteFor($user);
        $athleteId = $athlete ? $athlete->id : $user->id;
        // The account name is authoritative (see App\Models\Athlete: a linked
        // roster row has no `name` column of its own, only a possibly-stale
        // first/last name cache) — the submitter is always this signed-in user.
        $athleteName = $user->name;

        // A resubmission may only replace the caller's own, currently-rejected
        // submission — never someone else's, and never one already superseded.
        $supersedesId = null;
        if ($request->filled('supersedesId')) {
            $prior = Requirement::where('id', $request->supersedesId)
                ->where('athlete_id', $athleteId)
                ->where('status', 'rejected')
                ->first();
            $supersedesId = $prior?->id;
        }

        $fileUrl = null;
        if ($request->hasFile('file')) {
            $file = $request->file('file');
            // Generate a random, extension-controlled name. Never trust the
            // client-supplied original name (path traversal / overwrite /
            // double-extension tricks).
            $extension = strtolower($file->extension() ?: $file->getClientOriginalExtension());
            $fileName = Str::uuid().($extension ? ('.'.$extension) : '');
            $filePath = $file->storeAs('requirements', $fileName, 'public');
            $fileUrl = Storage::disk('public')->url($filePath);
        }

        $req = Requirement::create([
            'id' => Str::uuid(),
            'athlete_id' => $athleteId,
            'athlete_name' => $athleteName,
            'type' => $request->type,
            'requirement_type_id' => $request->requirementTypeId ?: null,
            'supersedes_id' => $supersedesId,
            'name' => $request->name,
            'description' => $request->description,
            'file_url' => $fileUrl,
            'status' => 'pending',
            'submitted_at' => now(),
        ]);

        return response()->json($req, 201);
    }

    public function updateStatus(Request $request, string $id)
    {
        $request->validate([
            'status' => 'required|in:pending,approved,rejected',
            'notes' => 'nullable|string',
        ]);

        $req = Requirement::findOrFail($id);
        $user = $request->user();

        // A coach may only review requirements belonging to athletes on their
        // own roster. Admins may review any.
        if ($user->role === 'coach') {
            $rosterIds = Athlete::where('coach_id', $user->id)->pluck('id')
                ->merge(User::where('coach_id', $user->id)->pluck('id'))
                ->unique();

            if (! $rosterIds->contains($req->athlete_id)) {
                return response()->json(['error' => 'Not found'], 404);
            }
        }

        $req->update([
            'status' => $request->status,
            'notes' => $request->notes,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        // Tell the athlete their document was reviewed.
        if ($request->status !== 'pending') {
            $athleteUser = Athlete::with('account')->find($req->athlete_id)?->account
                ?? User::find($req->athlete_id);
            $athleteUser?->notify(new RequirementReviewed($req->fresh()));
        }

        return response()->json($req->fresh());
    }

    /**
     * The caller's roster record. Prefer the `user_id` link (authoritative);
     * fall back to an email match only for legacy rows that were never linked.
     */
    private function athleteFor(User $user): ?Athlete
    {
        return Athlete::where('user_id', $user->id)->first()
            ?? Athlete::whereNull('user_id')->where('email', $user->email)->first();
    }

    /** The id `requirements.athlete_id` is stored under for this caller. */
    private function athleteIdFor(User $user): string
    {
        return $this->athleteFor($user)?->id ?? $user->id;
    }
}
