<?php

namespace Database\Seeders;

/**
 * Step 2 of 3, after TournamentResetSeeder: the team sports' competition —
 * Basketball and Volleyball group stages and playoffs (one final live now),
 * Beach Volleyball eliminations, Sepak Takraw and Chess leagues, with full
 * play-by-play, lineups and results — and a few friendlies.
 * Step 3, TournamentActivitySeeder, adds the racquet lines and the everyday
 * records. See TournamentActivitySeeder for the details.
 *
 *   /artisan-migrate?token=<TOKEN>&seed=1&class=TournamentGamesSeeder
 */
class TournamentGamesSeeder extends TournamentActivitySeeder
{
    protected string $part = 'games';
}
