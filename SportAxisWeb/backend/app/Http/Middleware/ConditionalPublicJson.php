<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * ETag + 304 Not Modified for public (signed-out) JSON reads.
 *
 * The public schedule, live board and standings poll the same URLs every few
 * seconds, and most polls return exactly what they did last time. With an
 * ETag the browser revalidates instead, and an unchanged answer comes back
 * as an empty 304 — the browser reuses the copy it has. `no-cache` means it
 * always asks first, so nothing stale is ever shown.
 *
 * Requests carrying a Bearer token are left alone, so no signed-in user's
 * data is kept in the browser's HTTP cache.
 */
class ConditionalPublicJson
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $request->isMethodCacheable()
            || $request->bearerToken() !== null
            || ! $response instanceof JsonResponse
            || $response->getStatusCode() !== 200) {
            return $response;
        }

        $response->setEtag(hash('xxh128', (string) $response->getContent()));
        $response->headers->set('Cache-Control', 'no-cache, private');
        $response->isNotModified($request);

        return $response;
    }
}
