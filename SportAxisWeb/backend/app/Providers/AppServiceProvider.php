<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;
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
        // Some MySQL/MariaDB setups (seen on InfinityFree) still default to
        // an index key length of 1000 bytes without innodb_large_prefix
        // enabled. utf8mb4 uses up to 4 bytes/char, so Laravel's default
        // string() length of 255 makes any unique/indexed string column
        // (users.email, etc.) exceed that the instant the table is created
        // fresh — "Specified key was too long". 191 chars * 4 bytes = 764,
        // safely under the limit, and plenty for every string column this
        // app actually has. Harmless everywhere else (modern MySQL 8 with
        // innodb_large_prefix never hits the limit regardless of this
        // setting) — this doesn't change local dev's already-migrated
        // tables, only future fresh migrations.
        Schema::defaultStringLength(191);

        $this->configureRateLimiters();
        $this->warnIfBroadcastingIsDegradedInProduction();
    }

    /**
     * `BROADCAST_CONNECTION=log` (the default) silently downgrades live
     * score/leaderboard updates to client-side polling instead of a crash,
     * which makes it easy to leave misconfigured in production without
     * anyone noticing. Log it loudly, once per boot, when that's the case.
     */
    protected function warnIfBroadcastingIsDegradedInProduction(): void
    {
        if (! app()->environment('production')) {
            return;
        }

        if (config('broadcasting.default') !== 'log') {
            return;
        }

        Log::warning(
            'BROADCAST_CONNECTION is "log" in production: live score/leaderboard '.
            'updates are silently falling back to client-side polling instead of '.
            'real-time push. Set BROADCAST_CONNECTION=reverb in .env and keep a '.
            '`php artisan reverb:start` process running under a supervisor '.
            '(systemd/supervisor) to restore real-time updates.'
        );
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
                    ->by('login:'.$email.'|'.$request->ip()),
                Limit::perMinute(config('security.login_ip_per_minute'))
                    ->by('login-ip:'.$request->ip()),
            ];
        });

        RateLimiter::for('sensitive', function (Request $request) {
            return Limit::perMinute(config('security.sensitive_per_minute'))->by($request->ip());
        });
    }
}
