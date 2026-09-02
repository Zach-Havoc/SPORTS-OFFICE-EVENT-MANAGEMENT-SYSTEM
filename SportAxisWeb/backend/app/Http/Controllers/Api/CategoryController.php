<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    public function index()
    {
        return response()->json(Category::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'        => 'required|string|unique:categories,name',
            'description' => 'nullable|string',
            'format'      => 'nullable|in:versus,ranked',
        ]);

        $category = Category::create([
            'id'          => Str::uuid(),
            'name'        => $request->name,
            'description' => $request->description,
            'format'      => $request->format ?: 'versus',
        ]);

        return response()->json($category, 201);
    }

    public function update(Request $request, string $id)
    {
        $category = Category::findOrFail($id);

        $request->validate([
            'name'        => 'required|string|unique:categories,name,' . $id . ',id',
            'description' => 'nullable|string',
            'format'      => 'nullable|in:versus,ranked',
        ]);

        $category->update($request->only('name', 'description', 'format'));
        return response()->json($category);
    }

    public function destroy(string $id)
    {
        Category::findOrFail($id)->delete();
        return response()->json(['message' => 'Category deleted']);
    }
}
