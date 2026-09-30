<?php

use App\Http\Controllers\MaintenanceController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// The API's own address. Where the website lives elsewhere (Render: the API
// and the site are separate services), send people to the site. Otherwise —
// the same host, as on InfinityFree, where the site has its own front door —
// just say what this is, instead of the framework's welcome page.
Route::get('/', function (Request $request) {
    $site = rtrim((string) config('app.frontend_url'), '/');
    if ($site !== '' && parse_url($site, PHP_URL_HOST) !== $request->getHost()) {
        return redirect()->away($site);
    }

    return response()->json(['name' => config('app.name'), 'api' => url('/api')]);
});

// Browser/curl-triggered migration runner for hosts with no CLI access
// (InfinityFree) — see MaintenanceController's docblock and
// INFINITYFREE_DEPLOYMENT.md. Token-protected, not tied to Sanctum/API auth
// since it has to be reachable before any of that is even set up.
Route::get('/artisan-migrate', [MaintenanceController::class, 'run']);
