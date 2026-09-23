<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\Paginates;
use App\Http\Controllers\Controller;
use App\Models\Athlete;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class AthleteController extends Controller
{
    use Paginates;

    /**
     * Fetch an athlete, enforcing that the current coach owns it.
     * Admins may access any athlete. Anyone else gets a 404 (rather than a
     * 403) so we don't disclose that the record exists.
     */
    private function findOwnedAthlete(Request $request, string $id): Athlete
    {
        $athlete = Athlete::findOrFail($id);
        $user = $request->user();

        if ($user->role !== 'admin' && $athlete->coach_id !== $user->id) {
            throw new NotFoundHttpException('Athlete not found');
        }

        return $athlete;
    }

    public function index(Request $request)
    {
        $user = $request->user();

        $query = Athlete::query()->with('account');
        if ($user->role === 'coach') {
            $query->where('coach_id', $user->id);
        }

        $athletes = $query->orderBy('last_name')->paginate($this->perPage($request, 50));
        $athletes->getCollection()->transform(fn (Athlete $a) => $this->withAccountProfile($a));

        return response()->json($athletes);
    }

    public function show(Request $request, string $id)
    {
        $athlete = $this->findOwnedAthlete($request, $id);

        return response()->json($this->withAccountProfile($athlete->load('account')));
    }

    /**
     * The athlete's `users` account is the single source of their identity and
     * profile. When the roster row is linked to one, project the account's
     * fields onto the response (in memory, never saved) so a coach always sees
     * exactly what the athlete set for themselves. The roster row itself only
     * really owns `sport` and `status`.
     */
    private function withAccountProfile(Athlete $athlete): Athlete
    {
        $acct = $athlete->relationLoaded('account') ? $athlete->account : null;

        if ($acct) {
            $name = trim((string) $acct->name);
            $athlete->first_name = str_contains($name, ' ') ? Str::before($name, ' ') : $name;
            $athlete->last_name = str_contains($name, ' ') ? Str::after($name, ' ') : '';
            $athlete->email = $acct->email;
            $athlete->student_id = $acct->sr_code ?: $athlete->student_id;
            $athlete->department = $acct->department;
            $athlete->year_level = $acct->year_level;
            $athlete->course = $acct->course;
            $athlete->emergency_contact = $acct->emergency_contact;
            $athlete->setAttribute('gender', $acct->gender);
            $athlete->setAttribute('phone', $acct->phone);
            $athlete->setAttribute('student_verified_at', $acct->student_verified_at);
        }

        $athlete->setAttribute('linked_account', (bool) $acct);
        $athlete->unsetRelation('account');

        return $athlete;
    }

    public function store(Request $request)
    {
        $request->validate([
            'studentId' => 'required|string|unique:athletes,student_id',
            'firstName' => 'required|string',
            'lastName' => 'required|string',
            'email' => 'required|email',
        ]);

        $coachId = $request->user()->id;

        // If this email already belongs to an athlete account, the roster row
        // only links to it — the account owns every personal detail.
        $account = User::where('role', 'athlete')
            ->whereRaw('LOWER(email) = ?', [mb_strtolower(trim($request->email))])
            ->first();

        if ($account && Athlete::where('coach_id', $coachId)->where('user_id', $account->id)->exists()) {
            return response()->json(['error' => 'This athlete is already on your roster.'], 422);
        }

        $athlete = Athlete::create([
            'id' => Str::uuid(),
            'user_id' => $account?->id,
            'coach_id' => $coachId,
            'sport' => $request->sport,
            'status' => $request->status ?? 'active',
            // Identity is only stored on the roster row for a coach-added athlete
            // who has no account yet; a linked athlete reads it from the account.
            'student_id' => $account ? null : $request->studentId,
            'first_name' => $account ? '' : $request->firstName,
            'last_name' => $account ? '' : $request->lastName,
            'email' => $request->email,
            'department' => $account ? null : $request->department,
            'year_level' => $account ? null : $request->yearLevel,
            'course' => $account ? null : $request->course,
            'emergency_contact' => $account ? null : $request->emergencyContact,
        ]);

        return response()->json($this->withAccountProfile($athlete->load('account')), 201);
    }

    /**
     * A coach manages roster status only. An athlete's identity and personal
     * details (name, SR code, gender, college, contact...) belong to the athlete
     * — set on their own account / verified against the campus record — and are
     * never editable by a coach.
     */
    public function update(Request $request, string $id)
    {
        $athlete = $this->findOwnedAthlete($request, $id);

        $data = $request->validate([
            'status' => ['sometimes', 'required', Rule::in(['active', 'inactive', 'injured'])],
        ]);

        if (array_key_exists('status', $data)) {
            $athlete->update(['status' => $data['status']]);
        }

        return response()->json($this->withAccountProfile($athlete->fresh()->load('account')));
    }

    public function destroy(Request $request, string $id)
    {
        $this->findOwnedAthlete($request, $id)->delete();

        return response()->json(['message' => 'Athlete deleted']);
    }

    /**
     * POST /athletes/{id}/restore — bring a soft-deleted roster row back.
     * The admin, or the coach who owns it.
     */
    public function restore(Request $request, string $id)
    {
        $athlete = Athlete::onlyTrashed()->findOrFail($id);
        $user = $request->user();

        if ($user->role !== 'admin' && $athlete->coach_id !== $user->id) {
            throw new NotFoundHttpException('Athlete not found');
        }

        $athlete->restore();

        return response()->json($this->withAccountProfile($athlete->fresh()->load('account')));
    }

    /** DELETE /athletes/{id}/remove — removes athlete from coach's roster (sets coach_id to null) */
    public function removeFromRoster(Request $request, string $id)
    {
        $athlete = $this->findOwnedAthlete($request, $id);
        $athlete->update(['coach_id' => null]);

        return response()->json(['message' => 'Athlete removed from roster']);
    }
}
