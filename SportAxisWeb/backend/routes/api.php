<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\EventController;
use App\Http\Controllers\Api\EventSessionController;
use App\Http\Controllers\Api\ScoreController;
use App\Http\Controllers\Api\RankingController;
use App\Http\Controllers\Api\VenueController;
use App\Http\Controllers\Api\RegistrationCodeController;
use App\Http\Controllers\Api\AthleteController;
use App\Http\Controllers\Api\CoachController;
use App\Http\Controllers\Api\EnrollController;
use App\Http\Controllers\Api\AnnouncementController;
use App\Http\Controllers\Api\TryoutController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\PerformanceController;
use App\Http\Controllers\Api\RequirementController;
use App\Http\Controllers\Api\JudgeController;
use App\Http\Controllers\Api\OcrController;
use App\Http\Controllers\Api\MatchController;
use App\Http\Controllers\Api\SiteSlideController;
use App\Http\Controllers\Api\BracketController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\LiveScoreController;

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
Route::get('/categories',  [CategoryController::class, 'index']);
Route::get('/venues',      [VenueController::class, 'index']);
Route::get('/events',      [EventController::class, 'index']);
Route::get('/events/{id}', [EventController::class, 'show']);
Route::get('/announcements', [AnnouncementController::class, 'index']);
Route::get('/rankings/{eventId}', [RankingController::class, 'show']);
Route::get('/leaderboard', [RankingController::class, 'leaderboard']);
Route::get('/scores/{eventId}', [ScoreController::class, 'show']);
Route::get('/judge/{id}/status', [ScoreController::class, 'status']);

// Live game scores — the running score of a game in progress.
Route::get('/live-scores',      [LiveScoreController::class, 'index']);
Route::get('/events/{id}/live', [LiveScoreController::class, 'show']);

// Head-to-head match records + standings (the bracket-seeding source)
Route::get('/matches',           [MatchController::class, 'index']);
Route::get('/matches/{id}',       [MatchController::class, 'show']);
Route::get('/standings/{sport}',  [MatchController::class, 'standings']);

// Persisted brackets + progression (read-only for the public tree view).
Route::get('/brackets',      [BracketController::class, 'index']);
Route::get('/brackets/{id}', [BracketController::class, 'show']);

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
    Route::post('/tryouts/apply',        [TryoutController::class, 'apply']);
});

// ─────────────────────────────────────────────
// AUTHENTICATED ROUTES (Sanctum token required)
// ─────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::get('/user',    [AuthController::class, 'user']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::put('/account/profile',  [AuthController::class, 'updateProfile']);
    Route::put('/account/password', [AuthController::class, 'updatePassword']);

    // Scores — only authenticated judges (or admins) may submit.
    // The judge identity is derived from the token server-side, not the body.
    Route::post('/scores', [ScoreController::class, 'store'])
        ->middleware('role:judge,admin');

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

    // ─── ADMIN ONLY ───────────────────────────
    Route::middleware('role:admin')->group(function () {
        Route::post('/departments', [DepartmentController::class, 'store']);
        Route::put('/departments/{id}', [DepartmentController::class, 'update']);
        Route::delete('/departments/{id}', [DepartmentController::class, 'destroy']);

        Route::post('/categories', [CategoryController::class, 'store']);
        Route::put('/categories/{id}', [CategoryController::class, 'update']);
        Route::delete('/categories/{id}', [CategoryController::class, 'destroy']);

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

        Route::post('/venues', [VenueController::class, 'store']);
        Route::put('/venues/{id}', [VenueController::class, 'update']);
        Route::delete('/venues/{id}', [VenueController::class, 'destroy']);

        Route::get('/registration-codes', [RegistrationCodeController::class, 'index']);
        Route::post('/registration-codes', [RegistrationCodeController::class, 'store']);
        Route::delete('/registration-codes/{code}', [RegistrationCodeController::class, 'destroy']);

        Route::get('/admin/coaches', [CoachController::class, 'index']);
        Route::put('/admin/coaches/{id}', [CoachController::class, 'updateCoach']);

        // User Management — every account, all roles, with cross-entity links.
        Route::get('/admin/users', [UserController::class, 'index']);
        Route::get('/admin/users/{id}', [UserController::class, 'show']);
        Route::put('/admin/users/{id}', [UserController::class, 'update']);
        Route::post('/admin/users/{id}/active', [UserController::class, 'setActive']);
        Route::post('/admin/users/{id}/reset-password', [UserController::class, 'resetPassword']);
        Route::delete('/admin/users/{id}', [UserController::class, 'destroy']);
    });

    // ─── COACH ONLY ───────────────────────────
    Route::middleware('role:coach')->group(function () {
        Route::get('/athletes', [AthleteController::class, 'index']);
        Route::get('/athletes/{id}', [AthleteController::class, 'show']);
        Route::post('/athletes', [AthleteController::class, 'store']);
        Route::put('/athletes/{id}', [AthleteController::class, 'update']);
        Route::delete('/athletes/{id}', [AthleteController::class, 'destroy']);
        Route::delete('/athletes/{id}/remove', [AthleteController::class, 'removeFromRoster']);

        Route::get('/coach/profile',  [CoachController::class, 'show']);
        Route::put('/coach/profile',  [CoachController::class, 'update']);

        Route::post('/announcements', [AnnouncementController::class, 'store']);
        Route::put('/announcements/{id}', [AnnouncementController::class, 'update']);
        Route::delete('/announcements/{id}', [AnnouncementController::class, 'destroy']);

        Route::post('/attendance', [AttendanceController::class, 'store']);
        Route::get('/attendance',  [AttendanceController::class, 'index']);

        Route::post('/performance', [PerformanceController::class, 'store']);
        Route::get('/performance',  [PerformanceController::class, 'index']);

        Route::get('/requirements', [RequirementController::class, 'index']);
        Route::put('/requirements/{id}/status', [RequirementController::class, 'updateStatus']);
    });

    // ─── ATHLETE ONLY ─────────────────────────
    Route::middleware('role:athlete')->group(function () {
        Route::post('/enroll',   [EnrollController::class, 'enroll']);
        Route::delete('/unenroll', [EnrollController::class, 'unenroll']);
        Route::get('/my-coach',  [EnrollController::class, 'myCoach']);

        Route::get('/performance/my', [PerformanceController::class, 'myRecords']);
        Route::get('/requirements/my', [RequirementController::class, 'myRequirements']);
        Route::post('/requirements', [RequirementController::class, 'store']);
    });

    // ─── ATHLETE + COACH ──────────────────────
    Route::middleware('role:athlete,coach')->group(function () {
        Route::get('/attendance', [AttendanceController::class, 'index']);
    });
});
