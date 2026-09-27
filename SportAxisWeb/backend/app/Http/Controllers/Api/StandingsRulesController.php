<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Support\StandingsRules;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Settings → Standings: how the college standings are ranked. */
class StandingsRulesController extends Controller
{
    public function show()
    {
        return response()->json(StandingsRules::current() + ['defaultPoints' => StandingsRules::DEFAULT_POINTS]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'method' => ['required', Rule::in(StandingsRules::METHODS)],
            'customPoints' => ['required_if:method,custom', 'array'],
            'customPoints.gold' => ['required_if:method,custom', 'integer', 'min:0', 'max:1000'],
            'customPoints.silver' => ['required_if:method,custom', 'integer', 'min:0', 'max:1000', 'lte:customPoints.gold'],
            'customPoints.bronze' => ['required_if:method,custom', 'integer', 'min:0', 'max:1000', 'lte:customPoints.silver'],
        ], [
            'customPoints.silver.lte' => 'Silver can\'t be worth more than gold.',
            'customPoints.bronze.lte' => 'Bronze can\'t be worth more than silver.',
        ]);

        $current = StandingsRules::current();
        AppSetting::write(StandingsRules::KEY, [
            'method' => $data['method'],
            'customPoints' => isset($data['customPoints'])
                ? array_map('intval', array_intersect_key($data['customPoints'], StandingsRules::DEFAULT_POINTS))
                : $current['customPoints'],
        ]);

        return $this->show();
    }
}
