<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiters();
    }

    /**
     * Named rate limiters used by the `throttle:` middleware.
     *
     *  - `api`   : a global ceiling on every /api/* request (see bootstrap/app.php).
     *              Keyed by user id when authenticated, else by client IP, so a
     *              single account or host cannot flood the backend.
     *  - `auth`  : the sign-in limiter for POST /api/login. Two buckets:
     *              a tight per-(email+IP) budget that blocks password guessing
     *              against one account, and a looser per-IP budget that stops
     *              one host from spraying attempts across many accounts.
     *  - `sensitive` : signup / reset-password, keyed by IP.
     */
    protected function configureRateLimiters(): void
    {
        RateLimiter::for('api', function (Request $request) {
            $key = $request->user()?->id ?: $request->ip();

            return Limit::perMinute(config('security.api_per_minute'))->by($key);
        });

        RateLimiter::for('auth', function (Request $request) {
            $email = mb_strtolower(trim((string) $request->input('email')));

            return [
                Limit::perMinute(config('security.login_per_minute'))
                    ->by('login:' . $email . '|' . $request->ip()),
                Limit::perMinute(config('security.login_ip_per_minute'))
                    ->by('login-ip:' . $request->ip()),
            ];
        });

        RateLimiter::for('sensitive', function (Request $request) {
            return Limit::perMinute(config('security.sensitive_per_minute'))->by($request->ip());
        });
    }
}
