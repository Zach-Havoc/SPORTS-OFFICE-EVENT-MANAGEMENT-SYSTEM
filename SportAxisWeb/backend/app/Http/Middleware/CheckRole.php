<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckRole
{
    /**
     * Handle an incoming request.
     *
     * @param  array<string>  $roles
     */
    public function handle(Request $request, Closure $next, string ...$roles): mixed
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        if (!in_array($user->role, $roles)) {
            return response()->json([
                'error' => 'Forbidden: requires role ' . implode(' or ', $roles),
            ], 403);
        }

        return $next($request);
    }
}
