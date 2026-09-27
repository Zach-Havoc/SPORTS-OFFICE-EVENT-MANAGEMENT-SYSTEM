<?php

namespace App\Support;

/**
 * Uploaded files are stored as a site-relative path ("/storage/requirements/x.pdf")
 * so the same row works on any host. Sent to a browser as-is, that path
 * resolves against the page's origin — the React app — which only works when
 * the app and the API share a domain (InfinityFree), not locally (5173 vs
 * 8000). Resolving it here, against the host that served the API request,
 * works in both.
 */
class PublicUrl
{
    public static function absolute(?string $path): ?string
    {
        if ($path === null || $path === '') {
            return $path;
        }
        if (preg_match('#^(https?:)?//#i', $path)) {
            return $path;
        }

        return url('/'.ltrim($path, '/'));
    }
}
