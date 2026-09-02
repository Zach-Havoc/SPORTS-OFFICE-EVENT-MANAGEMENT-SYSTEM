<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class DepartmentController extends Controller
{
    public function index()
    {
        return response()->json(Department::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'         => 'required|string|unique:departments,name',
            'abbreviation' => 'nullable|string|max:20',
        ]);

        $dept = Department::create([
            'id'           => Str::uuid(),
            'name'         => $request->name,
            'abbreviation' => $request->abbreviation,
        ]);

        return response()->json($dept, 201);
    }

    public function update(Request $request, string $id)
    {
        $dept = Department::findOrFail($id);

        $request->validate([
            'name'         => 'required|string|unique:departments,name,' . $id . ',id',
            'abbreviation' => 'nullable|string|max:20',
        ]);

        $dept->update($request->only('name', 'abbreviation'));
        return response()->json($dept);
    }

    public function destroy(string $id)
    {
        Department::findOrFail($id)->delete();
        return response()->json(['message' => 'College deleted']);
    }
}
