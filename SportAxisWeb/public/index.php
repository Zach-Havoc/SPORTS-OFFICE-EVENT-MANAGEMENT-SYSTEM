<?php

/**
 * InfinityFree split-deploy front controller — the ONE entry point at the
 * web root for both this SPA and the Laravel API. .htaccess in this same
 * directory routes every request that isn't a real file/directory here
 * (see that file's comments for why it has to be routed through PHP rather
 * than resolved by Apache's normal DirectoryIndex).
 *
 * - /api/*, /sanctum/*, and /artisan-migrate -> boot Laravel from core/ and
 *   let it handle the request, exactly like a normal Laravel public/index.php
 *   would, just with core/ instead of the app root two directories up.
 *   /artisan-migrate is a routes/web.php route (MaintenanceController),
 *   deliberately outside /api — any FUTURE routes.web.php route needs
 *   adding to this list too, or it silently falls into the SPA branch
 *   below and 404s from React Router instead of ever reaching Laravel.
 * - everything else -> this is a client-side-routed React app; there is
 *   no server-side route table to match against, so just hand back the
 *   SPA shell (index.html) and let react-router take over in the browser.
 *
 * NOT used for local dev or any non-InfinityFree deploy — this file only
 * matters once SportAxisWeb/backend is copied into a sibling core/ folder
 * at deploy time (see the GitHub Actions workflow and
 * INFINITYFREE_DEPLOYMENT.md). Local dev keeps using `php artisan serve`
 * and Vite's own dev server exactly as before.
 */

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';

if (! preg_match('#^/(api|sanctum)(/|$)#', $path) && $path !== '/artisan-migrate') {
    header('Content-Type: text/html; charset=UTF-8');
    readfile(__DIR__.'/index.html');
    exit;
}

// From here down: a normal Laravel public/index.php, just pointed at core/.

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

if (file_exists($maintenance = __DIR__.'/core/storage/framework/maintenance.php')) {
    require $maintenance;
}

// core/env.php (see env.php.example) populates real env vars — must happen
// BEFORE Laravel's autoload/bootstrap, since config/*.php files call env()
// while the framework boots. Missing entirely (e.g. local testing of this
// file directly, which normally never happens) just means env() falls back
// to whatever's already in the real environment/.env, same as any other
// Laravel app.
if (file_exists($envFile = __DIR__.'/core/env.php')) {
    foreach (require $envFile as $key => $value) {
        putenv("{$key}={$value}");
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }
}

require __DIR__.'/core/vendor/autoload.php';

/** @var Application $app */
$app = require_once __DIR__.'/core/bootstrap/app.php';

$app->handleRequest(Request::capture());
