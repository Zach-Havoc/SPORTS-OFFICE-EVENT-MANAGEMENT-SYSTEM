#!/usr/bin/env node

/**
 * Setup Verification Script
 * Checks if the development environment is properly configured
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Verifying BatStateU Scoring System Setup...\n');

let errors = 0;
let warnings = 0;

// Check Node.js version
console.log('✓ Checking Node.js version...');
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion < 18) {
  console.error(`  ❌ Node.js version ${nodeVersion} is too old. Please use v18 or higher.`);
  errors++;
} else {
  console.log(`  ✓ Node.js ${nodeVersion} (OK)`);
}

// Check if node_modules exists
console.log('✓ Checking dependencies...');
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
  console.error('  ❌ node_modules not found. Run "npm install" first.');
  errors++;
} else {
  console.log('  ✓ node_modules exists');
}

// Check if package.json exists
console.log('✓ Checking package.json...');
if (!fs.existsSync(path.join(__dirname, 'package.json'))) {
  console.error('  ❌ package.json not found.');
  errors++;
} else {
  console.log('  ✓ package.json exists');
}

// Check if .env file exists
console.log('✓ Checking environment variables...');
if (!fs.existsSync(path.join(__dirname, '.env'))) {
  console.warn('  ⚠️  .env file not found. Copy .env.example to .env and configure it.');
  warnings++;
} else {
  console.log('  ✓ .env file exists');
  
  // Check if .env has required variables
  const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf-8');
  const hasProjectId = envContent.includes('VITE_SUPABASE_PROJECT_ID');
  const hasAnonKey = envContent.includes('VITE_SUPABASE_ANON_KEY');
  
  if (!hasProjectId || !hasAnonKey) {
    console.warn('  ⚠️  .env file is missing required variables.');
    console.warn('     Make sure you have:');
    console.warn('     - VITE_SUPABASE_PROJECT_ID');
    console.warn('     - VITE_SUPABASE_ANON_KEY');
    warnings++;
  } else {
    console.log('  ✓ Environment variables configured');
  }
}

// Check TypeScript config
console.log('✓ Checking TypeScript configuration...');
if (!fs.existsSync(path.join(__dirname, 'tsconfig.json'))) {
  console.error('  ❌ tsconfig.json not found.');
  errors++;
} else {
  console.log('  ✓ tsconfig.json exists');
}

// Check Vite config
console.log('✓ Checking Vite configuration...');
if (!fs.existsSync(path.join(__dirname, 'vite.config.ts'))) {
  console.error('  ❌ vite.config.ts not found.');
  errors++;
} else {
  console.log('  ✓ vite.config.ts exists');
}

// Check index.html
console.log('✓ Checking HTML entry point...');
if (!fs.existsSync(path.join(__dirname, 'index.html'))) {
  console.error('  ❌ index.html not found.');
  errors++;
} else {
  console.log('  ✓ index.html exists');
}

// Check main.tsx
console.log('✓ Checking application entry point...');
if (!fs.existsSync(path.join(__dirname, 'src/main.tsx'))) {
  console.error('  ❌ src/main.tsx not found.');
  errors++;
} else {
  console.log('  ✓ src/main.tsx exists');
}

// Check critical source files
console.log('✓ Checking critical source files...');
const criticalFiles = [
  'src/app/App.tsx',
  'src/app/components/layout/MainLayout.tsx',
  'src/app/context/AuthContext.tsx',
  'src/app/services/api.ts',
];

criticalFiles.forEach(file => {
  if (!fs.existsSync(path.join(__dirname, file))) {
    console.error(`  ❌ ${file} not found.`);
    errors++;
  }
});

if (errors === 0 && criticalFiles.every(f => fs.existsSync(path.join(__dirname, f)))) {
  console.log('  ✓ All critical files present');
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('Setup Verification Summary:');
console.log('='.repeat(50));

if (errors === 0 && warnings === 0) {
  console.log('✅ All checks passed! Your setup is ready.');
  console.log('\nNext steps:');
  console.log('  1. Make sure .env is configured with Supabase credentials');
  console.log('  2. Run "npm run dev" to start the development server');
  console.log('  3. Visit http://localhost:5173 in your browser');
} else {
  if (errors > 0) {
    console.log(`❌ Found ${errors} error(s) - please fix them before continuing.`);
  }
  if (warnings > 0) {
    console.log(`⚠️  Found ${warnings} warning(s) - these might cause issues.`);
  }
  
  console.log('\nRecommended actions:');
  if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
    console.log('  1. Run "npm install" to install dependencies');
  }
  if (!fs.existsSync(path.join(__dirname, '.env'))) {
    console.log('  2. Copy .env.example to .env and configure it');
  }
  console.log('  3. Check the SETUP_GUIDE.md for detailed instructions');
  
  process.exit(1);
}

console.log('='.repeat(50) + '\n');
