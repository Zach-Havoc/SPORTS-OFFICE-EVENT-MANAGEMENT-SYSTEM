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

// ─────────────────────────────────────────────
// PUBLIC ROUTES (no authentication required)
// ─────────────────────────────────────────────
Route::post('/signup', [AuthController::class, 'signup']);
Route::post('/login',  [AuthController::class, 'login']);
Route::post('/reset-password', [AuthController::class, 'resetPassword']);

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

// ─── MOBILE JUDGE APP — Public QR Routes ─────────────────────────────────────
// These are intentionally public so judges can scan QR codes
// before authenticating and see the event details first.
Route::get('/event/session/{qrToken}', [EventSessionController::class, 'show']);
Route::get('/event/{id}/criteria',     [EventSessionController::class, 'criteria']);

// Public tryout
Route::post('/tryouts/verify-email', [TryoutController::class, 'verifyEmail']);
Route::post('/tryouts/apply',        [TryoutController::class, 'apply']);

// ─────────────────────────────────────────────
// AUTHENTICATED ROUTES (Sanctum token required)
// ─────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::get('/user',    [AuthController::class, 'user']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::put('/account/profile',  [AuthController::class, 'updateProfile']);
    Route::put('/account/password', [AuthController::class, 'updatePassword']);

    // Scores (judge)
    Route::post('/scores', [ScoreController::class, 'store']);

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

        Route::post('/events', [EventController::class, 'store']);
        Route::put('/events/{id}', [EventController::class, 'update']);
        Route::delete('/events/{id}', [EventController::class, 'destroy']);

        Route::post('/venues', [VenueController::class, 'store']);
        Route::put('/venues/{id}', [VenueController::class, 'update']);
        Route::delete('/venues/{id}', [VenueController::class, 'destroy']);

        Route::get('/registration-codes', [RegistrationCodeController::class, 'index']);
        Route::post('/registration-codes', [RegistrationCodeController::class, 'store']);
        Route::delete('/registration-codes/{code}', [RegistrationCodeController::class, 'destroy']);
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
