#!/usr/bin/env node

/**
 * Development bootstrap script
 * Starts both frontend (Vite) and backend (Node.js) servers
 * Handles graceful shutdown and port cleanup
 */

import { spawn } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { exec } = require('child_process');

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = (message, color = colors.reset) => {
  console.log(`${color}${message}${colors.reset}`);
};

// Store process references for cleanup
let frontendProcess = null;
let backendProcess = null;

// Kill processes on specific ports
const killPort = port => {
  return new Promise(resolve => {
    exec(`lsof -ti:${port} | xargs kill -9`, error => {
      if (error) {
        log(`No process found on port ${port}`, colors.yellow);
      } else {
        log(`Killed process on port ${port}`, colors.green);
      }
      resolve();
    });
  });
};

// Graceful shutdown handler
const cleanup = async () => {
  log('\n🛑 Shutting down servers...', colors.yellow);

  // Kill spawned processes
  if (frontendProcess) {
    frontendProcess.kill('SIGTERM');
    log('Frontend server stopped', colors.cyan);
  }

  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    log('Backend server stopped', colors.magenta);
  }

  // Clean up ports
  log('Cleaning up ports...', colors.yellow);
  await killPort(3000); // Frontend
  await killPort(3001); // Backend

  log('✅ Cleanup complete!', colors.green);
  process.exit(0);
};

// Handle various exit signals
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('SIGUSR1', cleanup);
process.on('SIGUSR2', cleanup);

// Main function to start both servers
const startServers = async () => {
  log('🚀 Starting Swanson Light Calendar...', colors.bright);

  // Clean up any existing processes on our ports
  log('Cleaning up existing processes...', colors.yellow);
  await killPort(3000);
  await killPort(3001);

  // Start backend server
  log('Starting backend server...', colors.magenta);
  backendProcess = spawn('npm', ['run', 'start:server:dev'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  });

  backendProcess.stdout.on('data', data => {
    const output = data.toString().trim();
    if (output) {
      log(`[BACKEND] ${output}`, colors.magenta);
    }
  });

  backendProcess.stderr.on('data', data => {
    const output = data.toString().trim();
    if (output) {
      log(`[BACKEND ERROR] ${output}`, colors.red);
    }
  });

  // Wait a moment for backend to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Start frontend server
  log('Starting frontend server...', colors.cyan);
  frontendProcess = spawn('npm', ['run', 'dev'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  });

  frontendProcess.stdout.on('data', data => {
    const output = data.toString().trim();
    if (output) {
      log(`[FRONTEND] ${output}`, colors.cyan);
    }
  });

  frontendProcess.stderr.on('data', data => {
    const output = data.toString().trim();
    if (output) {
      log(`[FRONTEND ERROR] ${output}`, colors.red);
    }
  });

  // Success message
  setTimeout(() => {
    log('\n🎉 Servers started successfully!', colors.green);
    log('Frontend: http://localhost:3000', colors.cyan);
    log('Backend:  http://localhost:3001', colors.magenta);
    log('\nPress Ctrl+C to stop both servers', colors.yellow);
  }, 3000);

  // Handle process exits
  frontendProcess.on('exit', code => {
    if (code !== 0) {
      log(`Frontend process exited with code ${code}`, colors.red);
      cleanup();
    }
  });

  backendProcess.on('exit', code => {
    if (code !== 0) {
      log(`Backend process exited with code ${code}`, colors.red);
      cleanup();
    }
  });
};

// Start the application
startServers().catch(error => {
  log(`Error starting servers: ${error.message}`, colors.red);
  cleanup();
});
