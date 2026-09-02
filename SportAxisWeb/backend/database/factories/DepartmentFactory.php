<?php

namespace Database\Factories;

use App\Models\Department;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Department> */
class DepartmentFactory extends Factory
{
    protected $model = Department::class;

    public function definition(): array
    {
        $name = 'College of ' . fake()->unique()->word();

        return [
            'id'           => (string) Str::uuid(),
            'name'         => ucwords($name),
            'abbreviation' => strtoupper(Str::substr(str_replace(' ', '', $name), 0, 4)),
        ];
    }
}
