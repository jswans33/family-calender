#!/usr/bin/env tsx

/**
 * Fix existing multi-day events to be all-day
 * Updates events that have dtend (end date) to clear their time field
 */

import sqlite3 from 'sqlite3';
import { process } from 'process';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'calendar.db');

async function fixMultiDayEvents(): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, err => {
      if (err) {
        reject(err);
        return;
      }
      console.log('Connected to database');
    });

    // Find events that have dtend (multi-day) but still have time values
    db.all(
      `SELECT id, title, date, time, dtend 
       FROM events 
       WHERE dtend IS NOT NULL 
       AND dtend != '' 
       AND time IS NOT NULL 
       AND time != ''`,
      [],
      (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(
          `Found ${rows.length} multi-day events with time values to fix`
        );

        if (rows.length === 0) {
          console.log('No events to fix');
          db.close();
          resolve();
          return;
        }

        // Update each event to clear the time field
        let completed = 0;
        rows.forEach(row => {
          console.log(
            `Fixing event: ${row.title} (${row.date} ${row.time} -> ${row.dtend})`
          );

          db.run(`UPDATE events SET time = '' WHERE id = ?`, [row.id], err => {
            if (err) {
              console.error(`Failed to update event ${row.id}:`, err);
            } else {
              console.log(`✅ Fixed event: ${row.title}`);
            }

            completed++;
            if (completed === rows.length) {
              console.log(`\n✅ Fixed ${rows.length} multi-day events`);
              db.close();
              resolve();
            }
          });
        });
      }
    );
  });
}

// Run the fix
fixMultiDayEvents()
  .then(() => {
    console.log('Multi-day event fix completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error fixing multi-day events:', error);
    process.exit(1);
  });
