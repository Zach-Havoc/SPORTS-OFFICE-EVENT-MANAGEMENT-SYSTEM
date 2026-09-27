<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

/** One office-wide setting (key => JSON value), read through a cache. */
class AppSetting extends Model
{
    use Auditable;

    protected $primaryKey = 'key';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['key', 'value'];

    protected $casts = ['value' => 'array'];

    public static function read(string $key, mixed $default = null): mixed
    {
        $value = Cache::rememberForever("app_setting:{$key}", function () use ($key) {
            // Before the migration has run (e.g. a fresh deploy), fall back to the default.
            if (! Schema::hasTable('app_settings')) {
                return null;
            }

            return static::find($key)?->value;
        });

        return $value ?? $default;
    }

    public static function write(string $key, array $value): void
    {
        $setting = static::firstOrNew(['key' => $key]);
        $setting->value = $value;
        $setting->save();
        Cache::forget("app_setting:{$key}");
    }
}
