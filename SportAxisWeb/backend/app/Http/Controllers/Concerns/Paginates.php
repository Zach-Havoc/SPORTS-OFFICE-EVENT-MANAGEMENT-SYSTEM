<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Http\Request;

trait Paginates
{
    /**
     * The page size for a paginated index endpoint. Respects a client-supplied
     * `per_page`, clamped to a sane range so nobody can request the whole table
     * in one page (defeating the point) or a page so small it's a footgun.
     */
    protected function perPage(Request $request, int $default = 25, int $max = 100): int
    {
        $requested = (int) $request->query('per_page', $default);

        return max(1, min($requested ?: $default, $max));
    }
}
