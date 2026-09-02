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
    */

    'api_per_minute'       => (int) env('API_RATE_LIMIT', 600),
    'login_per_minute'     => (int) env('LOGIN_RATE_LIMIT', 5),
    'login_ip_per_minute'  => (int) env('LOGIN_IP_RATE_LIMIT', 20),
    'sensitive_per_minute' => (int) env('SENSITIVE_RATE_LIMIT', 10),

];
