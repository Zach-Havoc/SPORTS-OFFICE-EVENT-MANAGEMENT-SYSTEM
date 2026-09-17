<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Season;
use Illuminate\Http\Request;

trait ResolvesSeason
{
    /**
     * Which season a public query should be scoped to.
     *
     *   ?season=<id>   an explicit edition
     *   ?season=all    no scope — every edition combined
     *   (absent)       the active edition, or no scope when none exists yet
     */
    protected function seasonScope(Request $request): ?string
    {
        $param = $request->query('season');

        if ($param === 'all') {
            return null;
        }

        if (is_string($param) && $param !== '') {
            return $param;
        }

        return Season::current()?->id;
    }
}
