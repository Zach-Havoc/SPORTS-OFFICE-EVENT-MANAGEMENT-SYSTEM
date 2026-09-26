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

    protected $fillable = [
        'id', 'title', 'content', 'sport', 'coach_id', 'coach_name', 'is_tryout',
        'tryout_date', 'tryout_start_time', 'tryout_end_time', 'tryout_venue',
    ];

    protected $casts = [
        'is_tryout' => 'boolean',
        'tryout_date' => 'date:Y-m-d',
    ];
}
