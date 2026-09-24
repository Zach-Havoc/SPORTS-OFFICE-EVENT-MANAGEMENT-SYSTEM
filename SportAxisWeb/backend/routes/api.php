<?php

use App\Http\Controllers\Api\AnnouncementController;
use App\Http\Controllers\Api\AthleteController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BracketController;
use App\Http\Controllers\Api\CampusStudentController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CmoApplicationController;
use App\Http\Controllers\Api\CoachController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\DisciplineEntryController;
use App\Http\Controllers\Api\EnrollController;
use App\Http\Controllers\Api\EventController;
use App\Http\Controllers\Api\EventSessionController;
use App\Http\Controllers\Api\JudgeController;
use App\Http\Controllers\Api\LiveScoreController;
use App\Http\Controllers\Api\MatchController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OcrController;
use App\Http\Controllers\Api\PerformanceController;
use App\Http\Controllers\Api\ProtestController;
use App\Http\Controllers\Api\RankingController;
use App\Http\Controllers\Api\RegistrationCodeController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RequirementController;
use App\Http\Controllers\Api\RequirementTypeController;
use App\Http\Controllers\Api\ScoreController;
use App\Http\Controllers\Api\SeasonController;
use App\Http\Controllers\Api\SiteSlideController;
use App\Http\Controllers\Api\TeamScheduleController;
use App\Http\Controllers\Api\TrashController;
use App\Http\Controllers\Api\TryoutController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\VenueController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// ─────────────────────────────────────────────
// PUBLIC ROUTES (no authentication required)
// ─────────────────────────────────────────────
// Sensitive auth endpoints are rate limited to slow credential/enumeration
// and registration-code brute-force attacks.
//   - login  : `auth` limiter — 5 tries / minute per (email + IP) plus a
//              20 / minute / IP ceiling (see AppServiceProvider). Blocks
//              password guessing against one account and spraying across many.
//   - signup / reset-password : `sensitive` limiter — 10 / minute / IP.
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:auth');

Route::middleware('throttle:sensitive')->group(function () {
    Route::post('/signup', [AuthController::class, 'signup']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
});

// Public read-only
Route::get('/departments', [DepartmentController::class, 'index']);
Route::get('/categories', [CategoryController::class, 'index']);
Route::get('/venues', [VenueController::class, 'index']);
Route::get('/seasons', [SeasonController::class, 'index']);
Route::get('/seasons/current', [SeasonController::class, 'current']);
Route::get('/events', [EventController::class, 'index']);
Route::get('/events/{id}', [EventController::class, 'show']);
Route::get('/announcements', [AnnouncementController::class, 'index']);
Route::get('/rankings/{eventId}', [RankingController::class, 'show']);
Route::get('/leaderboard', [RankingController::class, 'leaderboard']);
Route::get('/scores/{eventId}', [ScoreController::class, 'show']);
Route::get('/judge/{id}/status', [ScoreController::class, 'status']);

// Live game scores — the running score of a game in progress.
Route::get('/live-scores', [LiveScoreController::class, 'index']);
Route::get('/events/{id}/live', [LiveScoreController::class, 'show']);

// Head-to-head match records + standings (the bracket-seeding source)
Route::get('/matches', [MatchController::class, 'index']);
Route::get('/matches/{id}', [MatchController::class, 'show']);
Route::get('/standings/{sport}', [MatchController::class, 'standings']);

// Persisted brackets + progression (read-only for the public tree view).
Route::get('/brackets', [BracketController::class, 'index']);
Route::get('/brackets/{id}', [BracketController::class, 'show']);

// Racquet line-up (Singles A / B / Doubles) — names shown on the brackets.
Route::get('/discipline-entries', [DisciplineEntryController::class, 'index']);

// Admin-managed public imagery: the Live Events photo slideshow and the
// site-visit welcome popup.
Route::get('/site-slides', [SiteSlideController::class, 'publicIndex']);

// ─── MOBILE JUDGE APP — Public QR Routes ─────────────────────────────────────
// These are intentionally public so judges can scan QR codes
// before authenticating and see the event details first.
Route::get('/event/session/{qrToken}', [EventSessionController::class, 'show']);

// Public tryout — throttled to prevent email-verification (OTP) brute force
// and mail-bombing of arbitrary addresses.
Route::middleware('throttle:6,1')->group(function () {
    Route::post('/tryouts/verify-email', [TryoutController::class, 'verifyEmail']);
    Route::post('/tryouts/apply', [TryoutController::class, 'apply']);
});

// ─────────────────────────────────────────────
// AUTHENTICATED ROUTES (Sanctum token required)
// ─────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::get('/user', [AuthController::class, 'user']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::put('/account/profile', [AuthController::class, 'updateProfile']);
    Route::put('/account/password', [AuthController::class, 'updatePassword']);

    // In-app notifications (any signed-in user)
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);

    // Scores — only authenticated judges (or admins) may submit.
    // The judge identity is derived from the token server-side, not the body.
    Route::post('/scores', [ScoreController::class, 'store'])
        ->middleware('role:judge,admin');

    // Result lifecycle — verify / set aside / correct a score. Only verified
    // and official scores count toward the leaderboard.
    Route::middleware('role:judge,admin')->group(function () {
        Route::post('/scores/{id}/verify', [ScoreController::class, 'verify']);
        Route::post('/scores/{id}/dispute', [ScoreController::class, 'dispute']);
        Route::post('/scores/{id}/amend', [ScoreController::class, 'amend']);
    });

    // Protests — a coach files, the sports office resolves.
    Route::get('/protests', [ProtestController::class, 'index'])->middleware('role:admin,coach');
    Route::post('/protests', [ProtestController::class, 'store'])->middleware('role:coach');
    Route::post('/protests/{id}/resolve', [ProtestController::class, 'resolve'])->middleware('role:admin');

    // Live game score — the assigned scorekeeper (committee) or an admin pushes
    // the running score from the app while the game is being played.
    Route::put('/events/{id}/live', [LiveScoreController::class, 'upsert'])
        ->middleware('role:judge,admin');

    // ─── MOBILE JUDGE APP — Authenticated Routes ──────────────────────────────
    Route::post('/ocr/extract', [OcrController::class, 'extract']);

    // Tryouts (coach/admin read)
    Route::get('/tryouts', [TryoutController::class, 'index'])
        ->middleware('role:admin,coach');

    // Judges list (admin/coach)
    Route::get('/judges', [JudgeController::class, 'index'])
        ->middleware('role:admin,coach');

    // ─── RECOVERY & AUDIT ─────────────────────
    // Soft-deleted records (events, scores, athletes, brackets, announcements)
    // stay in the database and can be restored; every meaningful write is in
    // the audit trail. See App\Models\Concerns\Auditable.
    Route::middleware('role:admin')->group(function () {
        Route::get('/admin/trash', [TrashController::class, 'index']);
        Route::get('/admin/audit-logs', [AuditLogController::class, 'index']);
        Route::post('/events/{id}/restore', [EventController::class, 'restore']);
        Route::post('/brackets/{id}/restore', [BracketController::class, 'restore']);
        Route::delete('/scores/{id}', [ScoreController::class, 'destroy']);
        Route::post('/scores/{id}/restore', [ScoreController::class, 'restore']);
    });
    Route::middleware('role:admin,coach')->group(function () {
        Route::post('/athletes/{id}/restore', [AthleteController::class, 'restore']);
        Route::post('/announcements/{id}/restore', [AnnouncementController::class, 'restore']);
    });

    // ─── ADMIN ONLY ───────────────────────────
    Route::middleware('role:admin')->group(function () {
        Route::post('/departments', [DepartmentController::class, 'store']);
        Route::put('/departments/{id}', [DepartmentController::class, 'update']);
        Route::delete('/departments/{id}', [DepartmentController::class, 'destroy']);
        Route::post('/departments/{id}/logo', [DepartmentController::class, 'uploadLogo']);
        Route::delete('/departments/{id}/logo', [DepartmentController::class, 'deleteLogo']);

        Route::post('/categories', [CategoryController::class, 'store']);
        Route::put('/categories/{id}', [CategoryController::class, 'update']);
        Route::delete('/categories/{id}', [CategoryController::class, 'destroy']);

        Route::post('/seasons', [SeasonController::class, 'store']);
        Route::put('/seasons/{id}', [SeasonController::class, 'update']);
        Route::post('/seasons/{id}/activate', [SeasonController::class, 'activate']);
        Route::delete('/seasons/{id}', [SeasonController::class, 'destroy']);

        Route::post('/matches', [MatchController::class, 'store']);
        Route::put('/matches/{id}', [MatchController::class, 'update']);
        Route::delete('/matches/{id}', [MatchController::class, 'destroy']);

        Route::post('/brackets', [BracketController::class, 'store']);
        Route::post('/brackets/{id}/publish', [BracketController::class, 'publish']);
        Route::post('/brackets/{id}/matches/{matchId}/advance', [BracketController::class, 'advance']);
        Route::delete('/brackets/{id}', [BracketController::class, 'destroy']);

        Route::get('/admin/site-slides', [SiteSlideController::class, 'index']);
        Route::post('/admin/site-slides', [SiteSlideController::class, 'store']);
        Route::post('/admin/site-slides/reorder', [SiteSlideController::class, 'reorder']);
        Route::put('/admin/site-slides/{id}', [SiteSlideController::class, 'update']);
        Route::delete('/admin/site-slides/{id}', [SiteSlideController::class, 'destroy']);

        Route::post('/events', [EventController::class, 'store']);
        // Bulk ops — one request instead of N (registered before /events/{id}).
        Route::post('/events/bulk-delete', [EventController::class, 'bulkDestroy']);
        Route::post('/events/bulk-status', [EventController::class, 'bulkStatus']);
        Route::put('/events/{id}', [EventController::class, 'update']);
        Route::delete('/events/{id}', [EventController::class, 'destroy']);
        Route::delete('/events/{id}/live', [LiveScoreController::class, 'destroy']);
        Route::post('/events/{id}/officialize', [ScoreController::class, 'officialize']);

        Route::post('/venues', [VenueController::class, 'store']);
        Route::put('/venues/{id}', [VenueController::class, 'update']);
        Route::delete('/venues/{id}', [VenueController::class, 'destroy']);

        Route::get('/registration-codes', [RegistrationCodeController::class, 'index']);
        Route::post('/registration-codes', [RegistrationCodeController::class, 'store']);
        Route::delete('/registration-codes/{code}', [RegistrationCodeController::class, 'destroy']);

        Route::get('/admin/coaches', [CoachController::class, 'index']);
        Route::put('/admin/coaches/{id}', [CoachController::class, 'updateCoach']);

        // Office reports & exports (CSV / printable).
        Route::get('/reports/events/{eventId}', [ReportController::class, 'event']);
        Route::get('/reports/events/{eventId}/export', [ReportController::class, 'exportEvent']);
        Route::get('/reports/leaderboard/export', [ReportController::class, 'exportLeaderboard']);
        Route::get('/reports/certificates', [ReportController::class, 'certificates']);

        // Campus student registry — the registrar's roster, used to verify that
        // a signing-up athlete is a real enrolled student.
        Route::get('/admin/campus-students', [CampusStudentController::class, 'index']);
        Route::post('/admin/campus-students/import', [CampusStudentController::class, 'import']);

        // User Management — every account, all roles, with cross-entity links.
        Route::get('/admin/users', [UserController::class, 'index']);
        Route::get('/admin/users/{id}', [UserController::class, 'show']);
        Route::put('/admin/users/{id}', [UserController::class, 'update']);
        Route::post('/admin/users/{id}/active', [UserController::class, 'setActive']);
        Route::post('/admin/users/{id}/reset-password', [UserController::class, 'resetPassword']);
        Route::delete('/admin/users/{id}', [UserController::class, 'destroy']);

        // CMO (CHED Memorandum Order) applications — always office-reviewed,
        // unlike the coach-reviewed eligibility checklist in RequirementController.
        Route::get('/cmo-applications', [CmoApplicationController::class, 'index']);
        Route::put('/cmo-applications/{id}/status', [CmoApplicationController::class, 'updateStatus']);
    });

    // ─── COACH ONLY ───────────────────────────
    Route::middleware('role:coach')->group(function () {
        Route::get('/athletes', [AthleteController::class, 'index']);
        Route::get('/athletes/{id}', [AthleteController::class, 'show']);
        Route::post('/athletes', [AthleteController::class, 'store']);
        Route::put('/athletes/{id}', [AthleteController::class, 'update']);
        Route::delete('/athletes/{id}', [AthleteController::class, 'destroy']);
        Route::delete('/athletes/{id}/remove', [AthleteController::class, 'removeFromRoster']);

        Route::post('/discipline-entries', [DisciplineEntryController::class, 'store']);
        Route::delete('/discipline-entries/{id}', [DisciplineEntryController::class, 'destroy']);

        // The games this coach's college plays in the sports they handle.
        Route::get('/coach/schedule', [TeamScheduleController::class, 'index']);

        Route::get('/coach/profile', [CoachController::class, 'show']);
        Route::put('/coach/profile', [CoachController::class, 'update']);

        Route::post('/announcements', [AnnouncementController::class, 'store']);
        Route::put('/announcements/{id}', [AnnouncementController::class, 'update']);
        Route::delete('/announcements/{id}', [AnnouncementController::class, 'destroy']);

        Route::post('/attendance', [AttendanceController::class, 'store']);
        Route::get('/attendance', [AttendanceController::class, 'index']);

        // Attendance sessions — the coach creates many, each with its own roster.
        Route::get('/attendance/sessions', [AttendanceController::class, 'sessions']);
        Route::post('/attendance/sessions', [AttendanceController::class, 'createSession']);
        Route::get('/attendance/sessions/{id}', [AttendanceController::class, 'showSession']);
        Route::put('/attendance/sessions/{id}', [AttendanceController::class, 'updateSession']);
        Route::delete('/attendance/sessions/{id}', [AttendanceController::class, 'deleteSession']);
        Route::post('/attendance/sessions/{id}/records', [AttendanceController::class, 'saveRecords']);

        Route::post('/performance', [PerformanceController::class, 'store']);
        Route::get('/performance', [PerformanceController::class, 'index']);

        Route::get('/requirements', [RequirementController::class, 'index']);
        Route::put('/requirements/{id}/status', [RequirementController::class, 'updateStatus']);
    });

    // ─── ATHLETE ONLY ─────────────────────────
    Route::middleware('role:athlete')->group(function () {
        // Only the games this athlete's college plays in their sport.
        Route::get('/athlete/schedule', [TeamScheduleController::class, 'index']);
        Route::post('/enroll', [EnrollController::class, 'enroll']);
        Route::delete('/unenroll', [EnrollController::class, 'unenroll']);
        Route::get('/my-coach', [EnrollController::class, 'myCoach']);

        Route::get('/performance/my', [PerformanceController::class, 'myRecords']);
        Route::get('/requirements/my', [RequirementController::class, 'myRequirements']);
        Route::get('/requirements/my/clearance', [RequirementController::class, 'clearance']);
        Route::post('/requirements', [RequirementController::class, 'store']);
        Route::get('/my-team', [EnrollController::class, 'myTeam']);

        Route::get('/cmo-applications/my', [CmoApplicationController::class, 'myApplications']);
        Route::post('/cmo-applications', [CmoApplicationController::class, 'store']);
    });

    // ─── ATHLETE + COACH ──────────────────────
    Route::middleware('role:athlete,coach')->group(function () {
        Route::get('/attendance', [AttendanceController::class, 'index']);
    });

    // The eligibility checklist — any signed-in role may read it; only the
    // office/coach may manage it.
    Route::get('/requirement-types', [RequirementTypeController::class, 'index']);
    Route::middleware('role:admin,coach')->group(function () {
        Route::post('/requirement-types', [RequirementTypeController::class, 'store']);
        Route::put('/requirement-types/{id}', [RequirementTypeController::class, 'update']);
        Route::delete('/requirement-types/{id}', [RequirementTypeController::class, 'destroy']);
    });
});
