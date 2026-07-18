<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RegistrationCode;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class RegistrationCodeController extends Controller
{
    public function index()
    {
        return response()->json(RegistrationCode::orderByDesc('created_at')->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'role'          => 'required|in:admin,coach,athlete,judge',
            'label'         => 'nullable|string|max:255',
            'expiresInDays' => 'nullable|integer|min:1',
        ]);

        $code = RegistrationCode::create([
            'code'       => strtoupper(Str::random(8)),
            'role'       => $request->role,
            'label'      => $request->label,
            'created_by' => auth()->id(),
            'expires_at' => $request->expiresInDays
                ? now()->addDays($request->expiresInDays)
                : null,
        ]);

        return response()->json($code, 201);
    }

    public function destroy(string $code)
    {
        RegistrationCode::where('code', $code)->firstOrFail()->delete();
        return response()->json(['message' => 'Code revoked']);
    }
}
