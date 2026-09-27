<?php

/*
|--------------------------------------------------------------------------
| League rules
|--------------------------------------------------------------------------
|
| Rules the play-by-play scorer uses. Defaults follow FIBA.
|
*/

return [

    'basketball' => [

        // Points each play type is worth. The only place this map lives —
        // the scoreboard, the live-score sync and the box score all read it.
        'points' => [
            'FG2' => 2,
            'FG3' => 3,
            'FT' => 1,
            'FOUL' => 0,
        ],

        // Q1–Q4; period 5 and up are overtimes (OT1, OT2 …).
        'regulation_periods' => (int) env('BASKETBALL_REGULATION_PERIODS', 4),

        // FIBA counts every overtime as part of the last regulation period
        // for team fouls, so fouls carry over from Q4 into OT.
        'overtime_team_fouls_carry_over' => true,
    ],

    'volleyball' => [

        // Rally scoring. A set is won at this many points with a 2-point
        // lead; the deciding set (3rd of 3, 5th of 5) is shorter.
        'set_points' => (int) env('VOLLEYBALL_SET_POINTS', 25),
        'deciding_set_points' => (int) env('VOLLEYBALL_DECIDING_SET_POINTS', 15),
        'win_by' => 2,

        // Best of 3 or 5 sets; the committee picks before the first rally.
        'best_of' => [3, 5],
        'default_best_of' => (int) env('VOLLEYBALL_BEST_OF', 3),

        // Per team, per set (FIVB).
        'timeouts_per_set' => 2,
        'substitutions_per_set' => 6,
    ],

];
