<?php

namespace Tests\Feature;

use App\Console\Commands\BackupDatabase;
use Illuminate\Console\OutputStyle;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\BufferedOutput;
use Tests\TestCase;

class BackupDatabaseTest extends TestCase
{
    public function test_the_command_is_registered_with_a_keep_option(): void
    {
        $this->artisan('backup:database', ['--keep' => 1, '--help' => true])->assertSuccessful();
    }

    public function test_prune_removes_only_backups_older_than_the_window(): void
    {
        $dir = sys_get_temp_dir().'/backup-prune-'.uniqid();
        File::ensureDirectoryExists($dir);

        $old = $dir.'/db-old.sql.gz';
        $fresh = $dir.'/db-fresh.sql.gz';
        File::put($old, 'x');
        File::put($fresh, 'x');
        touch($old, now()->subDays(30)->timestamp);

        (new BackupDatabase)->prune($dir, 14);

        $this->assertFileDoesNotExist($old);
        $this->assertFileExists($fresh);

        File::deleteDirectory($dir);
    }

    public function test_it_uploads_the_backup_to_s3_when_configured(): void
    {
        config()->set('filesystems.disks.s3.bucket', 'sportaxis-backups-test');
        Storage::fake('s3');

        $this->cleanLocalBackups();

        $this->artisan('backup:database')->assertSuccessful()->run();

        $uploaded = Storage::disk('s3')->allFiles('backups');
        $this->assertCount(1, $uploaded, 'Expected exactly one file uploaded to the fake s3 disk.');
        $this->assertStringEndsWith('.sql.gz', $uploaded[0]);

        $this->cleanLocalBackups();
    }

    public function test_it_skips_s3_entirely_when_unconfigured(): void
    {
        config()->set('filesystems.disks.s3.bucket', null);

        // Deliberately not faking the s3 disk: if the command tried to touch
        // it with blank credentials, resolving/using the real driver would
        // throw, and this test would fail loudly instead of masking it.
        $this->cleanLocalBackups();

        // Chain the expectations, then run() explicitly: the PendingCommand
        // otherwise defers execution to its own __destruct (when the local
        // variable goes out of scope), which would fire *after* the
        // filesystem assertions below and make them see stale state.
        $this->artisan('backup:database')
            ->assertSuccessful()
            ->expectsOutputToContain('S3 not configured')
            ->run();

        $localFiles = File::glob(storage_path('app/backups/*.sql.gz'));
        $this->assertNotEmpty($localFiles, 'Expected the local backup to still be written.');

        $this->cleanLocalBackups();
    }

    public function test_pushoffsite_logs_and_prints_but_does_not_throw_on_upload_failure(): void
    {
        config()->set('filesystems.disks.s3.bucket', 'sportaxis-backups-test');

        $dir = sys_get_temp_dir().'/backup-offsite-fail-'.uniqid();
        File::ensureDirectoryExists($dir);
        $file = $dir.'/fake-backup.sql.gz';
        File::put($file, 'not a real dump, just bytes');

        Storage::shouldReceive('disk')
            ->with('s3')
            ->andThrow(new \RuntimeException('simulated network failure'));

        Log::shouldReceive('error')
            ->once()
            ->withArgs(fn (string $message) => str_contains($message, 'Offsite database backup upload failed'));

        $command = new BackupDatabase;
        $command->setLaravel($this->app);
        $command->setOutput(new OutputStyle(
            new ArrayInput([]),
            new BufferedOutput
        ));

        $reflection = new \ReflectionMethod($command, 'pushOffsite');
        $reflection->invoke($command, $file);

        // No exception escaped pushOffsite() — that's the whole point: an
        // offsite failure must never fail the backup command.
        $this->addToAssertionCount(1);

        File::deleteDirectory($dir);
    }

    private function cleanLocalBackups(): void
    {
        foreach (File::glob(storage_path('app/backups/*.sql.gz')) as $path) {
            File::delete($path);
        }
    }
}
