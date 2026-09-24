<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\Paginates;
use App\Http\Controllers\Controller;
use App\Models\Athlete;
use App\Models\CmoApplication;
use App\Models\User;
use App\Notifications\CmoApplicationReviewed;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CmoApplicationController extends Controller
{
    use Paginates;

    /** GET /api/cmo-applications — admin: every application, newest first. */
    public function index(Request $request)
    {
        $perPage = $this->perPage($request, 50);

        $query = CmoApplication::orderByDesc('submitted_at');
        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        return response()->json($query->paginate($perPage));
    }

    /** GET /api/cmo-applications/my — the caller's own applications. */
    public function myApplications(Request $request)
    {
        $athleteId = $this->athleteIdFor($request->user());

        return response()->json(
            CmoApplication::where('athlete_id', $athleteId)->orderByDesc('submitted_at')->get()
        );
    }

    /** POST /api/cmo-applications — athlete submits a new application. */
    public function store(Request $request)
    {
        $request->validate([
            'cmoReference' => 'required|string|max:150',
            'schoolYear' => 'required|string|max:20',
            'purpose' => 'required|string|max:255',
            'description' => 'nullable|string|max:2000',
            // Same restriction as RequirementController::store() — document/
            // image types only, never trust an uploaded extension otherwise.
            'file' => 'nullable|file|max:10240|mimes:pdf,doc,docx,jpg,jpeg,png',
        ]);

        $user = $request->user();
        $athlete = $this->athleteFor($user);
        $athleteId = $athlete ? $athlete->id : $user->id;
        $athleteName = $user->name;

        $fileUrl = null;
        if ($request->hasFile('file')) {
            try {
                $file = $request->file('file');
                $extension = strtolower($file->extension() ?: $file->getClientOriginalExtension());
                $fileName = Str::uuid().($extension ? ('.'.$extension) : '');
                $filePath = $file->storeAs('cmo_applications', $fileName, 'public');
                $fileUrl = Storage::url($filePath);
            } catch (\Exception $e) {
                report($e);

                return response()->json(['error' => 'Failed to store the uploaded file. Please try again.'], 500);
            }
        }

        $application = CmoApplication::create([
            'id' => Str::uuid(),
            'athlete_id' => $athleteId,
            'athlete_name' => $athleteName,
            'reference_no' => $this->generateReferenceNo($request->schoolYear),
            'cmo_reference' => $request->cmoReference,
            'school_year' => $request->schoolYear,
            'purpose' => $request->purpose,
            'description' => $request->description,
            'file_url' => $fileUrl,
            'status' => 'pending',
            'submitted_at' => now(),
        ]);

        return response()->json($application, 201);
    }

    /** PUT /api/cmo-applications/{id}/status — admin only. */
    public function updateStatus(Request $request, string $id)
    {
        $request->validate([
            'status' => 'required|in:pending,approved,rejected',
            'notes' => 'nullable|string',
        ]);

        $application = CmoApplication::findOrFail($id);

        $application->update([
            'status' => $request->status,
            'notes' => $request->notes,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        if ($request->status !== 'pending') {
            $athleteUser = Athlete::with('account')->find($application->athlete_id)?->account
                ?? User::find($application->athlete_id);
            $athleteUser?->notify(new CmoApplicationReviewed($application->fresh()));
        }

        return response()->json($application->fresh());
    }

    /** A short, unique, human-readable reference — never client-supplied. */
    private function generateReferenceNo(string $schoolYear): string
    {
        do {
            $candidate = sprintf('CMO-%s-%06d', $schoolYear, random_int(0, 999999));
        } while (CmoApplication::where('reference_no', $candidate)->exists());

        return $candidate;
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

    /** The id `cmo_applications.athlete_id` is stored under for this caller. */
    private function athleteIdFor(User $user): string
    {
        return $this->athleteFor($user)?->id ?? $user->id;
    }
}
