#!/usr/bin/env node

/**
 * Simple verification script to check if the frontend can be built
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔍 Verifying frontend build...');

try {
  // Change to frontend directory
  process.chdir(path.join(__dirname));
  
  console.log('📦 Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  
  console.log('🔧 Running TypeScript check...');
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  
  console.log('🏗️  Building application...');
  execSync('npm run build', { stdio: 'inherit' });
  
  console.log('✅ Frontend build verification successful!');
  console.log('');
  console.log('🚀 To start the development server, run:');
  console.log('   cd frontend && npm run dev');
  console.log('');
  console.log('📱 The application will be available at:');
  console.log('   http://localhost:3001');
  
} catch (error) {
  console.error('❌ Build verification failed:', error.message);
  process.exit(1);
}