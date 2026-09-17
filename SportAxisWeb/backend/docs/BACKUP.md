# Database backup & restore

The system of record during a live event is the MySQL database. This is the
runbook for backing it up and getting it back.

## What runs automatically

`php artisan backup:database` dumps MySQL with `mysqldump --single-transaction`
(a consistent snapshot, no table locks), pipes it through `gzip`, and writes:

```
storage/app/backups/<database>-YYYY-MM-DD_HHMMSS.sql.gz
```

It then deletes local backups older than **14 days** (`--keep=N` to change).

It is scheduled for **02:00 daily** in `routes/console.php`. That only fires if
the Laravel scheduler is running:

- **Production:** one cron line, every minute:
  ```
  * * * * * cd /path/to/SportAxisWeb/backend && php artisan schedule:run >> /dev/null 2>&1
  ```
- **Dev / a spare terminal:** `php artisan schedule:work`

Run it by hand any time: `php artisan backup:database`

## Requirements

- `mysqldump` and `gzip` on `PATH` (the `mysql-client` package).
- The `mysql` database connection configured in `.env`. The password is passed
  to `mysqldump` via `MYSQL_PWD`, not the command line.

## Off-site copy

The command always writes to local disk first — that write is unconditional
and has to succeed for the backup to count. On top of that, if the `s3`
filesystem disk is configured (i.e. `AWS_BUCKET`, `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, and — for non-AWS S3-compatible
endpoints — `AWS_ENDPOINT`/`AWS_USE_PATH_STYLE_ENDPOINT` are filled in in
`.env`), the command **automatically** pushes the same file to that disk under
`backups/<same filename>` right after the local write succeeds. No second cron
job needed for this case.

This is best-effort on top of the local copy, not a replacement for it: if the
bucket isn't configured, the command just logs a comment and moves on; if the
upload fails (bad credentials, network blip, bucket doesn't exist), the
failure is logged (`Log::error`) and printed, but the command still exits
successfully — the local backup already happened and that's what's graded.
Check logs periodically (or alert on the `Log::error` line) to catch upload
failures that would otherwise leave you without an offsite copy.

If your offsite destination is **not** S3-compatible object storage — e.g. a
plain rsync target, another host you control, or a non-S3 provider — the app
doesn't do that push for you. Set up a second, external cron job instead:

```
# after schedule:run, e.g. a second cron line at 02:30
30 2 * * * rclone copy /path/to/SportAxisWeb/backend/storage/app/backups remote:sportaxis-backups
```

Use any of: `rclone` to a non-S3 remote, `rsync` to another host, or a managed
MySQL provider's own snapshots. (`rclone`/`aws s3 sync` against an S3-compatible
bucket also still works as a belt-and-suspenders option even when `AWS_BUCKET`
is set — it's just no longer required.)

## Restore

1. Stop the app (or put it in maintenance mode: `php artisan down`).
2. Pick the file to restore from `storage/app/backups/`.
3. Recreate the schema target and load the dump:
   ```
   gunzip -c storage/app/backups/sportaxis-2026-09-10_020000.sql.gz \
     | mysql --host=127.0.0.1 --user=root -p sportaxis
   ```
   To restore into a fresh database instead of overwriting:
   ```
   mysql -uroot -p -e "CREATE DATABASE sportaxis_restore"
   gunzip -c <file> | mysql -uroot -p sportaxis_restore
   ```
   then point `DB_DATABASE` at it.
4. `php artisan migrate --force` — applies any migrations newer than the dump.
5. `php artisan up`.

## Verify a backup (do this monthly)

A backup you have never restored is a guess. Once a month:

```
gunzip -c <latest>.sql.gz | mysql -uroot -p sportaxis_verify
mysql -uroot -p sportaxis_verify -e "SELECT COUNT(*) FROM scores; SELECT COUNT(*) FROM events;"
mysql -uroot -p -e "DROP DATABASE sportaxis_verify"
```

Row counts in the same ballpark as production means the dump is good.
