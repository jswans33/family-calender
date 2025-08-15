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

    this.db.run(createTableSQL, (err) => {
      if (err) {
        console.error('Failed to create events table:', err);
        throw err;
      }
      console.log('Events table initialized successfully');
    });

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_events_date ON events(date)`, (err) => {
      if (err) console.error('Failed to create date index:', err);
    });

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_events_sync ON events(synced_at)`, (err) => {
      if (err) console.error('Failed to create sync index:', err);
    });
  }

  async saveEvents(events: CalendarEvent[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (events.length === 0) {
        resolve();
        return;
      }

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO events (
          id, title, date, time, description, location, organizer,
          attendees, categories, priority, status, visibility, dtend,
          duration, rrule, created, last_modified, sequence, url,
          geo_lat, geo_lon, transparency, attachments, timezone, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            console.error('Failed to start transaction:', err);
            reject(err);
            return;
          }
        });

        let hasError = false;
        let processedCount = 0;

        events.forEach(event => {
          stmt.run([
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
            event.timezone
          ], (err) => {
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
      });

      stmt.finalize((err) => {
        if (err) {
          console.error('Failed to finalize statement:', err);
        }
      });
    });
  }

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

  close(): void {
    this.db.close((err) => {
      if (err) {
        console.error('Error closing SQLite database:', err);
      } else {
        console.log('SQLite database connection closed successfully');
      }
    });
  }
}