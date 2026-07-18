<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;

class JudgeController extends Controller
{
    public function index()
    {
        $judges = User::where('role', 'judge')
            ->select('id', 'name', 'email', 'role')
            ->orderBy('name')
            ->get();

        return response()->json($judges);
    }
}
