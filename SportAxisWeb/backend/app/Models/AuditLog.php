<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * One immutable entry in the audit trail. Rows are written only by
 * {@see Auditable}; nothing in the app updates or deletes
 * them.
 */
class AuditLog extends Model
{
    /** Log rows are never updated. */
    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id', 'user_name', 'user_role', 'event',
        'auditable_type', 'auditable_id', 'old_values', 'new_values',
        'ip_address', 'user_agent', 'url',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'created_at' => 'datetime',
    ];

    /**
     * Master switch for the trail. Set to false around bulk imports, seeders or
     * data migrations whose writes are not a user action and would only add
     * noise. Use {@see self::withoutRecording()} rather than toggling directly.
     */
    public static bool $recording = true;

    /**
     * Run $callback with audit recording suspended, restoring the previous
     * state afterwards even if it throws.
     *
     * @template T
     *
     * @param  callable():T  $callback
     * @return T
     */
    public static function withoutRecording(callable $callback): mixed
    {
        $previous = self::$recording;
        self::$recording = false;

        try {
            return $callback();
        } finally {
            self::$recording = $previous;
        }
    }

    public function auditable(): MorphTo
    {
        return $this->morphTo();
    }

    /** The account that made the change, when it is still present. */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function toApiFormat(): array
    {
        return [
            'id' => $this->id,
            'event' => $this->event,
            'auditableType' => class_basename($this->auditable_type),
            'auditableId' => $this->auditable_id,
            'userId' => $this->user_id,
            'userName' => $this->user_name,
            'userRole' => $this->user_role,
            'oldValues' => $this->old_values,
            'newValues' => $this->new_values,
            'ipAddress' => $this->ip_address,
            'url' => $this->url,
            'createdAt' => $this->created_at,
        ];
    }
}
