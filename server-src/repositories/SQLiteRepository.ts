import sqlite3 from 'sqlite3';
import { CalendarEvent } from '../types/Calendar.js';

export class SQLiteRepository {
  private db: sqlite3.Database;

  constructor(dbPath: string = './calendar.db') {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Failed to connect to SQLite database:', err);
        throw err;
      }
      console.log('Connected to SQLite database at:', dbPath);
    });
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        description TEXT,
        location TEXT,
        organizer TEXT,
        attendees TEXT,
        categories TEXT,
        priority INTEGER,
        status TEXT,
        visibility TEXT,
        dtend TEXT,
        duration TEXT,
        rrule TEXT,
        created TEXT,
        last_modified TEXT,
        sequence INTEGER,
        url TEXT,
        geo_lat REAL,
        geo_lon REAL,
        transparency TEXT,
        attachments TEXT,
        timezone TEXT,
        synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        caldav_etag TEXT
      )
    `;

    const createDeletedTableSQL = `
      CREATE TABLE IF NOT EXISTS deleted_events (
        id TEXT PRIMARY KEY,
        deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced_to_caldav BOOLEAN DEFAULT 0
      )
    `;

    this.db.run(createTableSQL, (err) => {
      if (err) {
        console.error('Failed to create events table:', err);
        throw err;
      }
      console.log('Events table initialized successfully');
    });

    this.db.run(createDeletedTableSQL, (err) => {
      if (err) {
        console.error('Failed to create deleted_events table:', err);
      } else {
        console.log('Deleted events tracking table initialized');
      }
    });

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_events_date ON events(date)`, (err) => {
      if (err) console.error('Failed to create date index:', err);
    });

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_events_sync ON events(synced_at)`, (err) => {
      if (err) console.error('Failed to create sync index:', err);
    });
  }

  /**
   * Save events with smart sync - filters out locally deleted events AND handles CalDAV deletions
   */
  async saveEventsWithSmartSync(events: CalendarEvent[]): Promise<void> {
    return new Promise(async (resolve) => {
      // Get current event IDs from CalDAV
      const caldavEventIds = new Set(events.map(e => e.id));
      
      // Find events in local database that are missing from CalDAV
      const localEvents = await this.getAllEventIds();
      const missingFromCalDAV = localEvents.filter(id => !caldavEventIds.has(id));
      
      // Track CalDAV deletions (iPhone deletions)
      for (const eventId of missingFromCalDAV) {
        const isAlreadyDeleted = await this.isEventDeleted(eventId);
        if (!isAlreadyDeleted) {
          console.log(`Event ${eventId} missing from CalDAV - tracking as iPhone deletion`);
          await this.trackRemoteDeletion(eventId);
        }
      }

      if (events.length === 0) {
        resolve();
        return;
      }

      // Filter out events that were deleted locally
      const filteredEvents: CalendarEvent[] = [];
      for (const event of events) {
        const isDeleted = await this.isEventDeleted(event.id);
        if (!isDeleted) {
          filteredEvents.push(event);
        } else {
          console.log(`Skipping event ${event.id} - was deleted locally`);
        }
      }

      if (filteredEvents.length === 0) {
        console.log('No events to save after filtering deleted events');
        resolve();
        return;
      }

      // Save the filtered events with metadata preservation
      await this.saveEvents(filteredEvents, true);
      resolve();
    });
  }

  /**
   * Get all event IDs from the events table
   */
  async getAllEventIds(): Promise<string[]> {
    return new Promise((resolve) => {
      this.db.all(
        'SELECT id FROM events',
        [],
        (err, rows: any[]) => {
          if (err) {
            console.error('Error getting event IDs:', err);
            resolve([]);
          } else {
            resolve(rows.map(row => row.id));
          }
        }
      );
    });
  }

  /**
   * Track a remote deletion (iPhone deletion) - delete from events and track in deleted_events
   */
  async trackRemoteDeletion(eventId: string): Promise<void> {
    return new Promise((resolve) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        // Delete the event from events table
        this.db.run(
          'DELETE FROM events WHERE id = ?',
          [eventId],
          (err) => {
            if (err) {
              console.error('Error deleting event during remote deletion:', err);
              this.db.run('ROLLBACK');
              resolve();
              return;
            }
          }
        );
        
        // Track in deleted_events as already synced (since it came from CalDAV)
        this.db.run(
          'INSERT OR REPLACE INTO deleted_events (id, deleted_at, synced_to_caldav) VALUES (?, CURRENT_TIMESTAMP, 1)',
          [eventId],
          (err) => {
            if (err) {
              console.error('Error tracking remote deletion:', err);
              this.db.run('ROLLBACK');
            } else {
              this.db.run('COMMIT');
              console.log(`Event ${eventId} tracked as remote deletion`);
            }
            resolve();
          }
        );
      });
    });
  }

  async saveEvents(events: CalendarEvent[], preserveMetadata: boolean = false): Promise<void> {
    return new Promise((resolve, reject) => {
      if (events.length === 0) {
        resolve();
        return;
      }

      // Choose SQL based on whether to preserve metadata
      const sql = preserveMetadata ? `
        INSERT INTO events (
          id, title, date, time, description, location, organizer,
          attendees, categories, priority, status, visibility, dtend,
          duration, rrule, created, last_modified, sequence, url,
          geo_lat, geo_lon, transparency, attachments, timezone, sync_status, local_modified, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT synced_at FROM events WHERE id = ?), CURRENT_TIMESTAMP))
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          date = excluded.date,
          time = excluded.time,
          description = excluded.description,
          location = excluded.location,
          organizer = excluded.organizer,
          attendees = excluded.attendees,
          categories = excluded.categories,
          priority = excluded.priority,
          status = excluded.status,
          visibility = excluded.visibility,
          dtend = excluded.dtend,
          duration = excluded.duration,
          rrule = excluded.rrule,
          created = excluded.created,
          last_modified = excluded.last_modified,
          sequence = excluded.sequence,
          url = excluded.url,
          geo_lat = excluded.geo_lat,
          geo_lon = excluded.geo_lon,
          transparency = excluded.transparency,
          attachments = excluded.attachments,
          timezone = excluded.timezone
          -- Note: synced_at and caldav_etag are preserved
      ` : `
        INSERT OR REPLACE INTO events (
          id, title, date, time, description, location, organizer,
          attendees, categories, priority, status, visibility, dtend,
          duration, rrule, created, last_modified, sequence, url,
          geo_lat, geo_lon, transparency, attachments, timezone, sync_status, local_modified, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      // Handle empty events array
      if (events.length === 0) {
        console.log('No events to save');
        resolve();
        return;
      }

      const stmt = this.db.prepare(sql);

      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            console.error('Failed to start transaction:', err);
            reject(err);
            return;
          }

          let hasError = false;
          let processedCount = 0;

          events.forEach(event => {
          const params = [
            event.id,
            event.title,
            event.date,
            event.time,
            event.description,
            event.location,
            event.organizer,
            JSON.stringify(event.attendees || []),
            JSON.stringify(event.categories || []),
            event.priority,
            event.status,
            event.visibility,
            event.dtend,
            event.duration,
            event.rrule,
            event.created,
            event.lastModified,
            event.sequence,
            event.url,
            event.geo?.lat,
            event.geo?.lon,
            event.transparency,
            JSON.stringify(event.attachments || []),
            event.timezone,
            (event as any).sync_status || 'synced', // Add sync_status
            (event as any).local_modified || null    // Add local_modified
          ];

          // Add extra parameter for preserveMetadata case
          if (preserveMetadata) {
            params.push(event.id); // For COALESCE query
          }

          stmt.run(params, (err) => {
            if (err) {
              console.error(`Failed to save event ${event.id}:`, err);
              hasError = true;
            }
            
            processedCount++;
            
            if (processedCount === events.length) {
              if (hasError) {
                this.db.run('ROLLBACK', (rollbackErr) => {
                  if (rollbackErr) {
                    console.error('Failed to rollback transaction:', rollbackErr);
                  }
                  reject(new Error('Transaction failed and was rolled back'));
                });
              } else {
                this.db.run('COMMIT', (commitErr) => {
                  if (commitErr) {
                    console.error('Failed to commit transaction:', commitErr);
                    this.db.run('ROLLBACK');
                    reject(commitErr);
                  } else {
                    resolve();
                  }
                });
              }
            }
          });
        });

        stmt.finalize((err) => {
          if (err) {
            console.error('Failed to finalize statement:', err);
          }
        });
        }); // Close BEGIN TRANSACTION callback
      }); // Close db.serialize
    }); // Close Promise
  } // Close function

  async getEvents(startDate?: Date, endDate?: Date): Promise<CalendarEvent[]> {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM events';
      const params: any[] = [];

      if (startDate && endDate) {
        query += ' WHERE date >= ? AND date <= ?';
        params.push(startDate.toISOString(), endDate.toISOString());
      } else if (startDate) {
        query += ' WHERE date >= ?';
        params.push(startDate.toISOString());
      } else if (endDate) {
        query += ' WHERE date <= ?';
        params.push(endDate.toISOString());
      }

      query += ' ORDER BY date ASC';

      this.db.all(query, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const events = rows.map(this.rowToEvent);
        resolve(events);
      });
    });
  }

  async getLastSyncTime(): Promise<Date | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT MAX(synced_at) as last_sync FROM events',
        (err, row: any) => {
          if (err) reject(err);
          else resolve(row?.last_sync ? new Date(row.last_sync) : null);
        }
      );
    });
  }

  async clearOldEvents(olderThan: Date): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM events WHERE synced_at < ?',
        [olderThan.toISOString()],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  private rowToEvent(row: any): CalendarEvent {
    const event: CalendarEvent = {
      id: row.id,
      title: row.title,
      date: row.date,
      time: row.time
    };

    if (row.description) event.description = row.description;
    if (row.location) event.location = row.location;
    if (row.organizer) event.organizer = row.organizer;
    if (row.attendees) event.attendees = JSON.parse(row.attendees);
    if (row.categories) event.categories = JSON.parse(row.categories);
    if (row.priority) event.priority = row.priority;
    if (row.status) event.status = row.status;
    if (row.visibility) event.visibility = row.visibility;
    if (row.dtend) event.dtend = row.dtend;
    if (row.duration) event.duration = row.duration;
    if (row.rrule) event.rrule = row.rrule;
    if (row.created) event.created = row.created;
    if (row.last_modified) event.lastModified = row.last_modified;
    if (row.sequence) event.sequence = row.sequence;
    if (row.url) event.url = row.url;
    if (row.geo_lat && row.geo_lon) event.geo = { lat: row.geo_lat, lon: row.geo_lon };
    if (row.transparency) event.transparency = row.transparency;
    if (row.attachments) event.attachments = JSON.parse(row.attachments);
    if (row.timezone) event.timezone = row.timezone;

    return event;
  }

  async updateEventMetadata(eventId: string, metadata: { caldav_etag?: string, custom_data?: any }): Promise<void> {
    return new Promise((resolve, reject) => {
      const updateParts: string[] = [];
      const params: any[] = [];

      if (metadata.caldav_etag !== undefined) {
        updateParts.push('caldav_etag = ?');
        params.push(metadata.caldav_etag);
      }

      if (metadata.custom_data !== undefined) {
        // Could add custom_data column in future
        console.log('Custom metadata not yet supported:', metadata.custom_data);
      }

      if (updateParts.length === 0) {
        resolve();
        return;
      }

      params.push(eventId);
      const sql = `UPDATE events SET ${updateParts.join(', ')} WHERE id = ?`;

      this.db.run(sql, params, (err) => {
        if (err) {
          console.error(`Failed to update metadata for event ${eventId}:`, err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Delete an event from the database and track it as deleted
   */
  async deleteEvent(eventId: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.db.serialize(() => {
        // Start transaction
        this.db.run('BEGIN TRANSACTION');
        
        // Delete the event
        this.db.run(
          'DELETE FROM events WHERE id = ?',
          [eventId],
          (err) => {
            if (err) {
              console.error('Error deleting event:', err);
              this.db.run('ROLLBACK');
              resolve(false);
              return;
            }
          }
        );
        
        // Track the deletion
        this.db.run(
          'INSERT OR REPLACE INTO deleted_events (id, deleted_at, synced_to_caldav) VALUES (?, CURRENT_TIMESTAMP, 0)',
          [eventId],
          (err) => {
            if (err) {
              console.error('Error tracking deleted event:', err);
              this.db.run('ROLLBACK');
              resolve(false);
            } else {
              this.db.run('COMMIT');
              console.log(`Event ${eventId} deleted and tracked for sync`);
              resolve(true);
            }
          }
        );
      });
    });
  }

  /**
   * Check if an event was deleted locally
   */
  async isEventDeleted(eventId: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.db.get(
        'SELECT id FROM deleted_events WHERE id = ?',
        [eventId],
        (err, row) => {
          if (err) {
            console.error('Error checking deleted event:', err);
            resolve(false);
          } else {
            resolve(!!row);
          }
        }
      );
    });
  }

  /**
   * Get all deleted event IDs that need to sync to CalDAV
   */
  async getDeletedEventsToSync(): Promise<string[]> {
    return new Promise((resolve) => {
      this.db.all(
        'SELECT id FROM deleted_events WHERE synced_to_caldav = 0',
        [],
        (err, rows: any[]) => {
          if (err) {
            console.error('Error getting deleted events:', err);
            resolve([]);
          } else {
            resolve(rows.map(row => row.id));
          }
        }
      );
    });
  }

  /**
   * Mark a deleted event as synced to CalDAV
   */
  async markDeletedEventSynced(eventId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE deleted_events SET synced_to_caldav = 1 WHERE id = ?',
        [eventId],
        (err) => {
          if (err) {
            console.error('Error marking deleted event as synced:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Clean up old deleted event records (older than 30 days)
   */
  async cleanupDeletedEvents(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        "DELETE FROM deleted_events WHERE deleted_at < datetime('now', '-30 days') AND synced_to_caldav = 1",
        [],
        (err) => {
          if (err) {
            console.error('Error cleaning up deleted events:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  close(): void {
    this.db.close((err) => {
      if (err) {
        console.error('Error closing SQLite database:', err);
      } else {
        console.log('SQLite database connection closed successfully');
      }
    });
  }

  /**
   * Get events that need to be synced to CalDAV
   */
  async getPendingEvents(): Promise<CalendarEvent[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        "SELECT * FROM events WHERE sync_status = 'pending' ORDER BY local_modified ASC",
        [],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }
          const events = rows.map(this.rowToEvent);
          resolve(events);
        }
      );
    });
  }

  /**
   * Mark an event as synced to CalDAV
   */
  async markEventSynced(eventId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        "UPDATE events SET sync_status = 'synced' WHERE id = ?",
        [eventId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
}