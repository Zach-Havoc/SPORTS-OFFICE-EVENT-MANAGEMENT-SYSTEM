<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One entry in the office/coach-defined eligibility checklist — e.g. "Medical
 * Clearance". `sport` null applies to every sport; `required` false is
 * informational only and never blocks clearance.
 */
class RequirementType extends Model
{
    use Auditable;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'name', 'description', 'sport', 'required', 'active', 'created_by'];

    protected $casts = [
        'required' => 'boolean',
        'active' => 'boolean',
    ];

    public function requirements(): HasMany
    {
        return $this->hasMany(Requirement::class, 'requirement_type_id');
    }

    public function toApiFormat(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'sport' => $this->sport,
            'required' => $this->required,
            'active' => $this->active,
            'createdAt' => $this->created_at,
        ];
    }
}
