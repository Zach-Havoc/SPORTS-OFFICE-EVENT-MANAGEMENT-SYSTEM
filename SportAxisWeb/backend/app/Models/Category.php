<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['id', 'name', 'description', 'format'];

    /** How events of this sport are contested: 'versus' (2 teams) or 'ranked' (many). */
    public function eventFormat(): string
    {
        return $this->format ?: 'versus';
    }
}
