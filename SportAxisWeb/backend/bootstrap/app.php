<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Using token-based authentication (Bearer token) instead of cookie-based stateful API
        // $middleware->statefulApi();

        // Global request rate limit on every /api/* route. Runs first so
        // abusive traffic is shed before auth / route-model binding. The `api`
        // limiter is defined in AppServiceProvider; tighter per-route limits
        // (login, signup, tryouts) stack on top of this ceiling.
        $middleware->api(prepend: [
            \Illuminate\Routing\Middleware\ThrottleRequests::class . ':api',
        ]);

        // Register role middleware alias
        $middleware->alias([
            'role' => \App\Http\Middleware\CheckRole::class,
        ]);

        // Prepend CORS handling for all requests
        $middleware->append(\Illuminate\Http\Middleware\HandleCors::class);

        // Baseline security response headers (clickjacking / MIME sniffing / etc.)
        $middleware->append(\App\Http\Middleware\SecurityHeaders::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();
