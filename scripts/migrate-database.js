#!/usr/bin/env node

import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path
const dbPath = path.join(__dirname, '..', 'data', 'calendar.db');
const dbDir = path.dirname(dbPath);

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Connect to database
const db = new (sqlite3.verbose()).Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Failed to connect to database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// Migration functions
const migrations = [
  {
    name: 'Add start and end columns',
    check: `SELECT COUNT(*) as count FROM pragma_table_info('events') WHERE name='start'`,
    up: [
      `ALTER TABLE events ADD COLUMN start TEXT`,
      `ALTER TABLE events ADD COLUMN end TEXT`
    ]
  },
  {
    name: 'Add CalDAV metadata columns',
    check: `SELECT COUNT(*) as count FROM pragma_table_info('events') WHERE name='caldav_filename'`,
    up: [
      `ALTER TABLE events ADD COLUMN caldav_filename TEXT`,
      `ALTER TABLE events ADD COLUMN calendar_path TEXT`,
      `ALTER TABLE events ADD COLUMN calendar_name TEXT`
    ]
  },
  {
    name: 'Add vacation column',
    check: `SELECT COUNT(*) as count FROM pragma_table_info('events') WHERE name='is_vacation'`,
    up: [
      `ALTER TABLE events ADD COLUMN is_vacation BOOLEAN DEFAULT 0`
    ]
  },
  {
    name: 'Create vacation_balances table',
    check: `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='vacation_balances'`,
    up: [
      `CREATE TABLE IF NOT EXISTS vacation_balances (
        user_name TEXT PRIMARY KEY,
        balance_hours REAL DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ]
  },
  {
    name: 'Create deleted_events table',
    check: `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='deleted_events'`,
    up: [
      `CREATE TABLE IF NOT EXISTS deleted_events (
        id TEXT PRIMARY KEY,
        deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced_to_caldav BOOLEAN DEFAULT 0
      )`
    ]
  }
];

// Run migrations
async function runMigrations() {
  console.log('🔄 Running database migrations...\n');
  
  for (const migration of migrations) {
    await new Promise((resolve, reject) => {
      // Check if migration is needed
      db.get(migration.check, (err, row) => {
        if (err) {
          // Table might not exist yet, that's ok for table creation migrations
          if (migration.check.includes('sqlite_master')) {
            row = { count: 0 };
          } else {
            console.error(`❌ Error checking migration "${migration.name}":`, err);
            reject(err);
            return;
          }
        }
        
        if (row && row.count === 0) {
          console.log(`📦 Running migration: ${migration.name}`);
          
          // Run each SQL statement in the migration
          const statements = Array.isArray(migration.up) ? migration.up : [migration.up];
          let completed = 0;
          
          statements.forEach(sql => {
            db.run(sql, (err) => {
              if (err && !err.message.includes('duplicate column name')) {
                console.error(`   ❌ Failed: ${err.message}`);
              } else {
                console.log(`   ✅ Applied: ${sql.substring(0, 50)}...`);
              }
              
              completed++;
              if (completed === statements.length) {
                resolve();
              }
            });
          });
        } else {
          console.log(`⏭️  Skipping migration: ${migration.name} (already applied)`);
          resolve();
        }
      });
    });
  }
  
  console.log('\n✅ All migrations completed successfully!');
  db.close();
}

// Run the migrations
runMigrations().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});