<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DemoData\DemoDataService;
use App\Services\DemoData\DemoResetException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;

/**
 * Settings → "Reset & Load Demo Data". Two steps: the admin asks for a
 * signed link (valid 15 minutes), then posts to it with the confirmation
 * phrase typed out. Both need ALLOW_DEMO_RESET=true.
 */
class DemoResetController extends Controller
{
    /** Whether the reset is allowed here, and a signed link to run it if so. */
    public function link()
    {
        if (! DemoDataService::enabled()) {
            return response()->json(['enabled' => false, 'message' => 'Demo reset is turned off on this server (ALLOW_DEMO_RESET).']);
        }

        return response()->json([
            'enabled' => true,
            'confirmation' => DemoDataService::CONFIRMATION,
            'expiresAt' => now()->addMinutes(15)->toIso8601String(),
            // Relative, so it validates behind the dev proxy and on any host name.
            'url' => URL::temporarySignedRoute('admin.system.reset-demo', now()->addMinutes(15), absolute: false),
        ]);
    }

    public function reset(Request $request, DemoDataService $demo)
    {
        if (! DemoDataService::enabled()) {
            // 409, not 403: the web client treats any 403 as an expired session.
            return response()->json(['message' => 'Demo reset is turned off on this server (ALLOW_DEMO_RESET).'], 409);
        }
        $request->validate(['confirmation' => ['required', 'string', 'in:'.DemoDataService::CONFIRMATION]], [
            'confirmation.in' => 'Type '.DemoDataService::CONFIRMATION.' exactly to confirm.',
        ]);

        try {
            $result = $demo->reset($request->user(), 'web');
        } catch (DemoResetException $e) {
            return response()->json(['message' => $e->getMessage()], 409);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => 'The reset failed: '.$e->getMessage().' A backup was taken first — see storage/app/backups.'], 500);
        }

        return response()->json([
            'seconds' => $result['seconds'],
            'backup' => basename($result['backup']),
            'counts' => $result['counts'],
            'steps' => $result['steps'],
            'leaderboard' => $result['report']['leaderboard'] ?? [],
        ]);
    }
}
