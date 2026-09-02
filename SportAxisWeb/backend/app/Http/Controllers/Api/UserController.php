<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Athlete;
use App\Models\Event;
use App\Models\RegistrationCode;
use App\Models\Score;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Admin-only account management. Every user (all roles) is listed here with its
 * cross-entity links — a coach's athlete head-count, a committee member's score
 * and assigned-event counts, and the registration code that created the
 * account — so one screen ties the whole directory together.
 *
 * Accounts are never orphaned: a user with dependent records can be disabled
 * (blocked at login, history kept) but not deleted or re-roled until those
 * records are reassigned.
 */
class UserController extends Controller
{
    private const ROLES = ['admin', 'coach', 'athlete', 'judge'];

    /** GET /api/admin/users */
    public function index(Request $request)
    {
        $request->validate([
            'role'   => ['nullable', Rule::in(self::ROLES)],
            'status' => 'nullable|in:active,inactive',
            'search' => 'nullable|string|max:255',
        ]);

        $query = User::query();

        if ($request->filled('role')) {
            $query->where('role', $request->role);
        }
        if ($request->status === 'active') {
            $query->where('active', true);
        } elseif ($request->status === 'inactive') {
            $query->where('active', false);
        }
        if ($request->filled('search')) {
            $term = '%' . $request->search . '%';
            $query->where(fn ($q) => $q->where('name', 'like', $term)->orWhere('email', 'like', $term));
        }

        $rows = $this->withLinks($query->orderBy('name')->get())
            ->map(fn ($entry) => $entry['row'])
            ->values();

        return response()->json($rows);
    }

    /** GET /api/admin/users/{id} — one account plus the records linked to it. */
    public function show(string $id)
    {
        $user = User::findOrFail($id);
        $row  = $this->withLinks(collect([$user]))->first()['row'];

        $athletes = Athlete::where('coach_id', $user->id)
            ->orderBy('last_name')
            ->get(['id', 'first_name', 'last_name', 'sport', 'status']);

        $roster = User::where('coach_id', $user->id)
            ->where('role', 'athlete')
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'sport']);

        $scores = Score::where('judge_id', $user->id)
            ->orderByDesc('created_at')
            ->limit(20)
            ->get(['id', 'event_id', 'department', 'total_score', 'created_at']);

        $assignedEvents = Event::all(['id', 'name', 'category', 'schedule', 'status', 'judges'])
            ->filter(fn ($e) => collect($e->judges ?? [])->contains(fn ($j) => ($j['id'] ?? null) === $user->id))
            ->map(fn ($e) => [
                'id'       => $e->id,
                'name'     => $e->name,
                'category' => $e->category,
                'schedule' => $e->schedule,
                'status'   => $e->status,
            ])
            ->values();

        $code = RegistrationCode::where('used_by', $user->id)->first();

        return response()->json([
            'user'             => $row,
            'athletes'         => $athletes,
            'roster'           => $roster,
            'scores'           => $scores,
            'assignedEvents'   => $assignedEvents,
            'registrationCode' => $code ? ['code' => $code->code, 'label' => $code->label, 'usedAt' => $code->used_at] : null,
        ]);
    }

    /** PUT /api/admin/users/{id} */
    public function update(Request $request, string $id)
    {
        $user  = User::findOrFail($id);
        $actor = $request->user();

        $data = $request->validate([
            'name'           => 'sometimes|required|string|max:255',
            'email'          => ['sometimes', 'required', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'role'           => ['sometimes', 'required', Rule::in(self::ROLES)],
            'department'     => 'sometimes|nullable|string|max:255',
            'sport'          => 'sometimes|nullable|string|max:100',
            'genderCategory' => 'sometimes|nullable|string|max:50',
        ]);

        if (array_key_exists('role', $data) && $data['role'] !== $user->role) {
            $this->assertRoleChangeAllowed($user, $actor);
        }

        $columns = ['genderCategory' => 'gender_category'];
        $mapped  = [];
        foreach ($data as $key => $value) {
            $value = is_string($value) ? trim($value) : $value;
            $mapped[$columns[$key] ?? $key] = $value === '' ? null : $value;
        }

        $user->update($mapped);

        return response()->json($this->withLinks(collect([$user->fresh()]))->first()['row']);
    }

    /** POST /api/admin/users/{id}/active  { active: bool } */
    public function setActive(Request $request, string $id)
    {
        $user   = User::findOrFail($id);
        $actor  = $request->user();
        $active = $request->validate(['active' => 'required|boolean'])['active'];

        if (!$active) {
            if ($user->id === $actor->id) {
                throw ValidationException::withMessages(['active' => ['You cannot disable your own account.']]);
            }
            if ($user->role === 'admin' && !$this->otherActiveAdminsExist($user->id)) {
                throw ValidationException::withMessages(['active' => ['This is the last active admin.']]);
            }
        }

        $user->update(['active' => $active]);

        if (!$active) {
            $user->tokens()->delete(); // sign the disabled user out everywhere
        }

        return response()->json($this->withLinks(collect([$user->fresh()]))->first()['row']);
    }

    /** POST /api/admin/users/{id}/reset-password  { password?: string } */
    public function resetPassword(Request $request, string $id)
    {
        $user = User::findOrFail($id);

        $temp = $request->validate(['password' => 'nullable|string|min:8|max:72'])['password']
            ?? Str::password(12, symbols: false);

        $user->update(['password' => Hash::make($temp)]);
        $user->tokens()->delete();

        return response()->json(['tempPassword' => $temp]);
    }

    /** DELETE /api/admin/users/{id} */
    public function destroy(Request $request, string $id)
    {
        $user  = User::findOrFail($id);
        $actor = $request->user();

        if ($user->id === $actor->id) {
            throw ValidationException::withMessages(['user' => ['You cannot delete your own account.']]);
        }
        if ($user->role === 'admin' && !$this->otherActiveAdminsExist($user->id)) {
            throw ValidationException::withMessages(['user' => ['This is the last admin.']]);
        }
        if ($this->coachDependents($user) > 0) {
            throw ValidationException::withMessages(['user' => ['User still has athletes.']]);
        }
        if (Score::where('judge_id', $user->id)->exists()) {
            throw ValidationException::withMessages(['user' => ['User has submitted scores.']]);
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => 'User deleted']);
    }

    // ── guards ─────────────────────────────────────────────────────────

    private function assertRoleChangeAllowed(User $user, User $actor): void
    {
        if ($user->id === $actor->id) {
            throw ValidationException::withMessages(['role' => ['You cannot change your own role.']]);
        }
        if ($user->role === 'admin' && !$this->otherActiveAdminsExist($user->id)) {
            throw ValidationException::withMessages(['role' => ['This is the last admin.']]);
        }
        if ($user->role === 'coach' && $this->coachDependents($user) > 0) {
            throw ValidationException::withMessages(['role' => ['Coach still has athletes.']]);
        }
        if ($user->role === 'judge' && Score::where('judge_id', $user->id)->exists()) {
            throw ValidationException::withMessages(['role' => ['Committee has scores.']]);
        }
    }

    private function otherActiveAdminsExist(string $exceptId): bool
    {
        return User::where('role', 'admin')
            ->where('active', true)
            ->where('id', '!=', $exceptId)
            ->exists();
    }

    private function coachDependents(User $user): int
    {
        if ($user->role !== 'coach') {
            return 0;
        }

        return Athlete::where('coach_id', $user->id)->count()
            + User::where('coach_id', $user->id)->where('role', 'athlete')->count();
    }

    // ── enrichment ─────────────────────────────────────────────────────

    /**
     * Attach cross-entity link counts to a set of users in a fixed number of
     * queries (no per-row lookups). Returns entries of `['model' => User,
     * 'row' => array]`.
     */
    private function withLinks(Collection $users): Collection
    {
        $ids = $users->pluck('id');

        $athleteCounts = Athlete::whereIn('coach_id', $ids)
            ->selectRaw('coach_id, count(*) as c')->groupBy('coach_id')->pluck('c', 'coach_id');
        $rosterCounts = User::whereIn('coach_id', $ids)->where('role', 'athlete')
            ->selectRaw('coach_id, count(*) as c')->groupBy('coach_id')->pluck('c', 'coach_id');
        $scoreCounts = Score::whereIn('judge_id', $ids)
            ->selectRaw('judge_id, count(*) as c')->groupBy('judge_id')->pluck('c', 'judge_id');
        $codes = RegistrationCode::whereIn('used_by', $ids)->get()->keyBy('used_by');

        $eventCounts = [];
        if ($users->contains(fn ($u) => $u->role === 'judge')) {
            foreach (Event::all(['judges']) as $event) {
                foreach ($event->judges ?? [] as $judge) {
                    if ($jid = $judge['id'] ?? null) {
                        $eventCounts[$jid] = ($eventCounts[$jid] ?? 0) + 1;
                    }
                }
            }
        }

        return $users->map(fn (User $u) => [
            'model' => $u,
            'row'   => array_merge($u->toApiFormat(), [
                'createdAt' => $u->created_at,
                'links'     => [
                    'athleteCount'       => (int) ($athleteCounts[$u->id] ?? 0) + (int) ($rosterCounts[$u->id] ?? 0),
                    'scoreCount'         => (int) ($scoreCounts[$u->id] ?? 0),
                    'assignedEventCount' => (int) ($eventCounts[$u->id] ?? 0),
                    'registrationCode'   => optional($codes->get($u->id))->code,
                ],
            ]),
        ]);
    }
}
