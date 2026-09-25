#!/usr/bin/env node
// Start Expo pointed at a chosen backend, without editing .env:
//
//   npm run start:local   -> http://<this computer's current LAN IP>:8000/api
//   npm run start:prod    -> PROD_API_URL (below, or set it in your shell)
//
// Extra args pass through to `expo start` (e.g. `npm run start:prod -- --tunnel`).
// The bundle cache is cleared each time (-c) because EXPO_PUBLIC_* values are
// baked in when Metro boots.
const os = require('os');
const { spawn } = require('child_process');

const PROD_API_URL = process.env.PROD_API_URL || 'https://sportsaxis-api.onrender.com/api';

function lanIp() {
  const candidates = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  // Prefer the usual home/campus Wi-Fi ranges over VPN/Docker bridges.
  return (
    candidates.find((a) => a.startsWith('192.168.')) ||
    candidates.find((a) => a.startsWith('10.')) ||
    candidates[0]
  );
}

const [target, ...rest] = process.argv.slice(2);
let url;
if (target === 'prod') {
  url = PROD_API_URL;
} else if (target === 'local') {
  const ip = lanIp();
  if (!ip) {
    console.error('No LAN IPv4 address found — connect to Wi-Fi first.');
    process.exit(1);
  }
  url = `http://${ip}:8000/api`;
  console.log('Make sure the backend listens on the network: php artisan serve --host=0.0.0.0 --port=8000');
} else {
  console.error('Usage: node scripts/start-with-api.js <local|prod> [expo args]');
  process.exit(1);
}

console.log(`API → ${url}`);
const child = spawn('npx', ['expo', 'start', '-c', ...rest], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, EXPO_PUBLIC_API_URL: url },
});
child.on('exit', (code) => process.exit(code ?? 0));
