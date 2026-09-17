<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Daily database backup to storage/app/backups (see docs/BACKUP.md). Requires
// a running scheduler: `php artisan schedule:work` in dev, or a cron entry
// calling `schedule:run` every minute in production.
Schedule::command('backup:database')
    ->dailyAt('02:00')
    ->withoutOverlapping();
