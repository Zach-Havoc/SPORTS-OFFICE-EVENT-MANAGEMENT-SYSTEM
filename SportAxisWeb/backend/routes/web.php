<?php

use App\Http\Controllers\MaintenanceController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Browser/curl-triggered migration runner for hosts with no CLI access
// (InfinityFree) — see MaintenanceController's docblock and
// INFINITYFREE_DEPLOYMENT.md. Token-protected, not tied to Sanctum/API auth
// since it has to be reachable before any of that is even set up.
Route::get('/artisan-migrate', [MaintenanceController::class, 'run']);
