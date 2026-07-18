<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Venue;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class VenueController extends Controller
{
    public function index()
    {
        return response()->json(Venue::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'     => 'required|string',
            'type'     => 'required|string',
            'capacity' => 'required|integer|min:1',
            'location' => 'required|string',
            'status'   => 'in:available,unavailable,maintenance',
        ]);

        $venue = Venue::create([
            'id'         => Str::uuid(),
            'name'       => $request->name,
            'type'       => $request->type,
            'capacity'   => $request->capacity,
            'sports'     => $request->sports ?? [],
            'location'   => $request->location,
            'facilities' => $request->facilities,
            'status'     => $request->status ?? 'available',
            'created_by' => auth()->id(),
        ]);

        return response()->json($venue, 201);
    }

    public function update(Request $request, string $id)
    {
        $venue = Venue::findOrFail($id);

        $venue->update(array_filter([
            'name'       => $request->name,
            'type'       => $request->type,
            'capacity'   => $request->capacity,
            'sports'     => $request->sports,
            'location'   => $request->location,
            'facilities' => $request->facilities,
            'status'     => $request->status,
        ], fn($v) => !is_null($v)));

        return response()->json($venue->fresh());
    }

    public function destroy(string $id)
    {
        Venue::findOrFail($id)->delete();
        return response()->json(['message' => 'Venue deleted']);
    }
}
