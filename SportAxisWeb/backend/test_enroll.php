<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = App\Models\User::where('role', 'athlete')->first();
if (!$user) { echo "No athlete\n"; exit; }

$request = Illuminate\Http\Request::create('/api/enroll', 'POST', ['enrollmentCode' => 'UOZRCPS3']);
$request->setUserResolver(function() use ($user) { return $user; });

$controller = new App\Http\Controllers\Api\EnrollController();
try {
    $response = $controller->enroll($request);
    echo $response->getContent() . "\n";
} catch (\Exception $e) {
    echo "Exception: " . $e->getMessage() . "\n";
}
