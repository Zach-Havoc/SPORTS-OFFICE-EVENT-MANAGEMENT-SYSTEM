<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Announcement extends Model
{
    use Auditable;
    use SoftDeletes;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'title', 'content', 'sport', 'coach_id', 'coach_name', 'is_tryout'];

    protected $casts = [
        'is_tryout' => 'boolean',
    ];
}
