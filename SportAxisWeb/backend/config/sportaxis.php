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

];
