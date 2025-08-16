#!/usr/bin/env node

/**
 * Stop script for Swanson Light Calendar
 * Kills all processes on ports 3000 and 3001
 * Provides clean shutdown for development servers
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { exec } = require('child_process');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

const log = (message, color = colors.reset) => {
  console.log(`${color}${message}${colors.reset}`);
};

// Kill processes on specific port
const killPort = port => {
  return new Promise(resolve => {
    exec(`lsof -ti:${port}`, (error, stdout) => {
      if (error || !stdout.trim()) {
        log(`No process found on port ${port}`, colors.yellow);
        resolve();
        return;
      }

      const pids = stdout.trim().split('\n');
      exec(`kill -9 ${pids.join(' ')}`, killError => {
        if (killError) {
          log(
            `Error killing processes on port ${port}: ${killError.message}`,
            colors.red
          );
        } else {
          log(
            `Killed ${pids.length} process(es) on port ${port}`,
            colors.green
          );
        }
        resolve();
      });
    });
  });
};

// Main cleanup function
const stopServers = async () => {
  log('🛑 Stopping Swanson Light Calendar servers...', colors.yellow);

  await killPort(3000); // Frontend
  await killPort(3001); // Backend

  // Also kill any npm/node processes that might be hanging
  exec(`pkill -f "npm run dev"`, () => {});
  exec(`pkill -f "npm run start:server:dev"`, () => {});

  log('✅ All servers stopped and ports cleaned up!', colors.green);
};

stopServers().catch(error => {
  log(`Error stopping servers: ${error.message}`, colors.red);
  process.exit(1);
});
