<?php

namespace App\Models\Concerns;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Auth;

/**
 * Records every create / update / delete / restore of the model into
 * `audit_logs`. Eloquent boots this automatically via {@see self::bootAuditable()}.
 *
 * A model may narrow what is captured with a `$auditExclude` array property
 * (merged with the always-excluded framework columns and secrets). Fields that
 * changed but are excluded from value capture are still noted, by name, under
 * the `_redacted` key so a password reset still leaves a trail.
 */
trait Auditable
{
    /** Columns whose values are never written into the trail. */
    protected function auditExcluded(): array
    {
        $always = ['password', 'remember_token', 'created_at', 'updated_at', 'deleted_at'];
        $custom = property_exists($this, 'auditExclude') ? (array) $this->auditExclude : [];

        return array_values(array_unique([...$always, ...$custom]));
    }

    public static function bootAuditable(): void
    {
        static::created(function ($model) {
            $model->writeAuditLog('created', [], $model->auditableAttributes($model->getAttributes()));
        });

        static::updated(function ($model) {
            $changes = $model->getChanges();
            unset($changes['updated_at'], $changes['deleted_at']);
            if (empty($changes)) {
                return; // a no-op save, or the deleted_at touch from restore()
            }

            $excluded = $model->auditExcluded();
            $newVisible = array_diff_key($changes, array_flip($excluded));

            $oldVisible = [];
            foreach (array_keys($newVisible) as $key) {
                $oldVisible[$key] = $model->getRawOriginal($key);
            }

            $redacted = array_values(array_intersect(array_keys($changes), $excluded));
            $new = $newVisible;
            if ($redacted !== []) {
                $new['_redacted'] = $redacted;
            }

            $model->writeAuditLog('updated', $oldVisible, $new);
        });

        static::deleted(function ($model) {
            $usesSoftDeletes = in_array(SoftDeletes::class, class_uses_recursive($model), true);
            $event = $usesSoftDeletes && ! $model->trashed() ? 'force_deleted' : 'deleted';

            $model->writeAuditLog($event, $model->auditableAttributes($model->getAttributes()), []);
        });

        if (in_array(SoftDeletes::class, class_uses_recursive(static::class), true)) {
            static::restored(function ($model) {
                $model->writeAuditLog('restored', [], $model->auditableAttributes($model->getAttributes()));
            });
        }
    }

    /**
     * Append a custom, named entry to this model's trail — for domain events
     * that are not a plain attribute change (e.g. "verified", "published").
     *
     * @param  array<string, mixed>  $old
     * @param  array<string, mixed>  $new
     */
    public function recordAudit(string $event, array $old = [], array $new = []): void
    {
        $this->writeAuditLog($event, $old, $new);
    }

    /** @param  array<string, mixed>  $attributes */
    protected function auditableAttributes(array $attributes): array
    {
        return array_diff_key($attributes, array_flip($this->auditExcluded()));
    }

    /**
     * @param  array<string, mixed>  $old
     * @param  array<string, mixed>  $new
     */
    protected function writeAuditLog(string $event, array $old, array $new): void
    {
        if (! AuditLog::$recording) {
            return;
        }

        $actor = Auth::user();

        // request() is always bound; on a console-triggered write it is a stub
        // (method "GET", path "/") which is harmless to record.
        $request = request();
        $viaHttp = ! app()->runningInConsole();

        AuditLog::create([
            'user_id' => $actor?->getKey(),
            'user_name' => $actor?->name,
            'user_role' => $actor?->role,
            'event' => $event,
            'auditable_type' => $this->getMorphClass(),
            'auditable_id' => (string) $this->getKey(),
            'old_values' => $old !== [] ? $old : null,
            'new_values' => $new !== [] ? $new : null,
            'ip_address' => $viaHttp ? $request->ip() : null,
            'user_agent' => $viaHttp ? mb_substr((string) $request->userAgent(), 0, 512) : null,
            'url' => mb_substr($request->method().' '.$request->path(), 0, 512),
        ]);
    }
}
