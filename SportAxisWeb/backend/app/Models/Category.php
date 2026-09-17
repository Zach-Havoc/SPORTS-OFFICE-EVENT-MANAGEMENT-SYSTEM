<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class Category extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'name', 'description', 'format', 'parent_sport', 'division', 'parent_id'];

    protected static function booted(): void
    {
        // A discipline names its parent sport in `parent_sport`; keep the real
        // key beside it so nothing has to match on that text.
        static::saved(fn (Category $category) => $category->syncParentKey());
    }

    /** Resolve `parent_sport` (a name) to `parent_id` (a key). */
    public function syncParentKey(): void
    {
        if (! $this->wasRecentlyCreated && ! $this->wasChanged('parent_sport') && $this->parent_id !== null) {
            return;
        }

        $parentId = $this->parent_sport
            ? static::whereRaw('LOWER(name) = ?', [mb_strtolower(trim($this->parent_sport))])
                ->where('id', '!=', $this->id)
                ->value('id')
            : null;

        if ($parentId !== $this->parent_id) {
            DB::table('categories')->where('id', $this->id)->update(['parent_id' => $parentId]);
            $this->attributes['parent_id'] = $parentId;
        }
    }

    /** How events of this sport are contested: 'versus' (2 teams) or 'ranked' (many). */
    public function eventFormat(): string
    {
        return $this->format ?: 'versus';
    }

    /**
     * A "discipline" is one line of a racquet sport (e.g. "Badminton — M
     * Doubles"): grouped under a parent sport, contested as its own bracket.
     */
    public function isDiscipline(): bool
    {
        return ! empty($this->parent_sport);
    }

    /** 'M' | 'W' for a discipline, else null. */
    public function divisionGender(): ?string
    {
        if (! $this->division) {
            return null;
        }

        return str_starts_with($this->division, 'W') ? 'W' : 'M';
    }

    /** Which line this discipline is: 'A' | 'B' (singles) or 'CD' (doubles), else null. */
    public function lineSlot(): ?string
    {
        if (! $this->division) {
            return null;
        }
        if (str_contains($this->division, 'Doubles')) {
            return 'CD';
        }

        return str_ends_with($this->division, 'B') ? 'B' : 'A';
    }

    /** The parent sport of a racquet discipline (null for a top-level sport). */
    public function parent()
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    /** The disciplines played under this sport (e.g. Badminton -> M Singles A). */
    public function disciplines()
    {
        return $this->hasMany(self::class, 'parent_id');
    }
}
