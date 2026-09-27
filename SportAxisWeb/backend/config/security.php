<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Rate limiting
    |--------------------------------------------------------------------------
    |
    | These feed the named rate limiters registered in AppServiceProvider.
    | Values are read here (not via env() in the provider) so they survive
    | `php artisan config:cache` in production.
    |
    | api_per_minute  – global ceiling for every /api/* request, keyed by
    |                   authenticated user id (falls back to client IP for
    |                   guests). A generous default so normal dashboard use is
    |                   never affected; lower it if the box is under pressure.
    |
    | login_per_minute – failed-attempt budget for POST /api/login, keyed by
    |                    (email + IP). Stops password guessing / credential
    |                    stuffing against a single account.
    |
    | login_ip_per_minute – secondary login ceiling keyed by IP alone, so one
    |                       host cannot spray attempts across many emails.
    |
    | sensitive_per_minute – signup / reset-password budget, keyed by IP.
    |
    | live_per_minute – the public live-score reads (the live board, one game's
    |                   live score, a basketball scoreboard). Viewers poll
    |                   these every few seconds when there's no realtime
    |                   socket, and a whole campus can share one IP, so they
    |                   get their own, larger per-IP budget instead of
    |                   counting against api_per_minute.
    |
    */

    'api_per_minute' => (int) env('API_RATE_LIMIT', 600),
    'login_per_minute' => (int) env('LOGIN_RATE_LIMIT', 5),
    'login_ip_per_minute' => (int) env('LOGIN_IP_RATE_LIMIT', 20),
    'sensitive_per_minute' => (int) env('SENSITIVE_RATE_LIMIT', 10),
    'live_per_minute' => (int) env('LIVE_RATE_LIMIT', 6000),

];
