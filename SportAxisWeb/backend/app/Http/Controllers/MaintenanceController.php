<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;

/**
 * A browser/curl-triggered stand-in for `php artisan migrate` on hosts with
 * no SSH/CLI access (InfinityFree). Every Artisan call here is just PHP
 * application code running inside a normal HTTP request — no shell access
 * needed — which is exactly what a host like this *can* run; it's `composer
 * install` (needs a real shell) that a host like this categorically cannot,
 * which is why vendor/ is uploaded once by hand instead (see
 * INFINITYFREE_DEPLOYMENT.md).
 */
class MaintenanceController extends Controller
{
    public function run(Request $request)
    {
        $token = (string) config('app.migration_token');

        if ($token === '' || ! hash_equals($token, (string) $request->query('token', ''))) {
            abort(403, 'Invalid or missing token.');
        }

        $log = [];
        $hadFailure = false;
        // A bad --class name (typo, wrong namespace) throws a real PHP
        // Error from inside Artisan::call, not just a non-zero exit code —
        // uncaught, that crashes to Laravel's generic error page and hides
        // which step actually failed. Catch it, record it instead.
        $capture = function (string $command, array $params = []) use (&$log, &$hadFailure) {
            $label = "\$ php artisan {$command}".($params ? ' '.json_encode($params) : '');
            try {
                Artisan::call($command, $params);
                $log[] = $label."\n".trim(Artisan::output());
            } catch (\Throwable $e) {
                $hadFailure = true;
                $log[] = $label."\nFAILED: ".$e->getMessage();
            }
        };

        if (! $hadFailure) {
            if ($request->boolean('fresh')) {
                $capture('migrate:fresh', ['--force' => true]);
            } else {
                $capture('migrate', ['--force' => true]);
            }
        }

        if (! $hadFailure && $request->boolean('seed')) {
            $class = $request->query('class');
            $capture('db:seed', array_filter([
                '--force' => true,
                '--class' => $class,
            ], fn ($v) => $v !== null));
        }

        if (! $hadFailure && $request->boolean('storage')) {
            $capture('storage:link');
        }

        // Always runs, even after an earlier failure — config/route/view
        // caches must reflect whatever env.php and routes look like *right
        // now*, not a previous deploy's cache — a half-finished migration
        // shouldn't also leave stale caches behind to debug separately.
        // (Doesn't reset $hadFailure — an earlier failure still means 500.)
        $capture('optimize:clear');

        return response('<pre>'.e(implode("\n\n", $log))."</pre>", $hadFailure ? 500 : 200)
            ->header('Content-Type', 'text/html; charset=UTF-8');
    }
}
