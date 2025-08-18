/**
 * Debug configuration for the application
 * Set DEBUG environment variable to enable debug logging
 */

export const DEBUG = {
  // Enable all debug logging
  enabled: process.env.DEBUG === 'true' || process.env.DEBUG === '*',
  
  // Specific debug categories
  caldav: process.env.DEBUG?.includes('caldav') || process.env.DEBUG === '*',
  database: process.env.DEBUG?.includes('database') || process.env.DEBUG === '*',
  sync: process.env.DEBUG?.includes('sync') || process.env.DEBUG === '*',
  timezone: process.env.DEBUG?.includes('timezone') || process.env.DEBUG === '*',
};

export function debugLog(category: keyof typeof DEBUG | 'enabled', ...args: any[]) {
  if (category === 'enabled' && DEBUG.enabled) {
    console.log(...args);
  } else if (category !== 'enabled' && DEBUG[category]) {
    console.log(...args);
  }
}