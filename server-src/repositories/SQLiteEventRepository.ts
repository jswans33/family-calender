import { CalendarEvent } from '../types/Calendar.js';
import { SQLiteBaseRepository } from './SQLiteBaseRepository.js';

// Database row interfaces for proper typing
interface DatabaseEventRow {
  id: string;
  title: string;
  date: string;
  time: string;
  start?: string;
  end?: string;
  description?: string;
  location?: string;
  organizer?: string;
  attendees?: string;
  categories?: string;
  priority?: number;
  status?: string;
  visibility?: string;
  dtend?: string;
  duration?: string;
  rrule?: string;
  created?: string;
  last_modified?: string;
  sequence?: number;
  url?: string;
  geo_lat?: number;
  geo_lon?: number;
  transparency?: string;
  attachments?: string;
  timezone?: string;
  is_vacation?: number;
  caldav_filename?: string;
  calendar_path?: string;
  calendar_name?: string;
  sync_status?: string;
  local_modified?: string;
  caldav_etag?: string;
  balance_hours?: number;
  last_sync?: string;
}

interface EventMetadata {
  caldav_etag?: string;
  custom_data?: Record<string, unknown>;
}

/**
 * Repository for event-specific database operations
 * Handles CRUD operations for calendar events
 */
export class SQLiteEventRepository extends SQLiteBaseRepository {
  
  /**
   * Save events to database with metadata preservation option
   */
  async saveEvents(
    events: CalendarEvent[],
    preserveMetadata: boolean = false
  ): Promise<void> {
    if (events.length === 0) return;

    const sql = this.buildSaveEventsSQL(preserveMetadata);
    return this.executeEventTransaction(events, sql, preserveMetadata);
  }

  /**
   * Get events with optional date range and calendar filtering
   */
  async getEvents(
    startDate?: Date,
    endDate?: Date,
    calendar?: string
  ): Promise<CalendarEvent[]> {
    return new Promise((resolve, reject) => {
      const { query, params } = this.buildEventsQuery(startDate, endDate, calendar);

      this.db.all(query, params, (err, rows: DatabaseEventRow[]) => {
        if (err) {
          reject(err);
          return;
        }
        const events = rows.map(this.rowToEvent);
        resolve(events);
      });
    });
  }

  /**
   * Update event metadata (etag, custom data)
   */
  async updateEventMetadata(
    eventId: string,
    metadata: EventMetadata
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const { updateParts, params } = this.buildMetadataUpdate(metadata, eventId);
      
      if (updateParts.length === 0) {
        resolve();
        return;
      }

      const sql = `UPDATE events SET ${updateParts.join(', ')} WHERE id = ?`;
      this.db.run(sql, params, err => {
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
   * Delete an event and track the deletion
   */
  async deleteEvent(eventId: string): Promise<boolean> {
    return new Promise(resolve => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        this.db.run('DELETE FROM events WHERE id = ?', [eventId], err => {
          if (err) {
            console.error('Error deleting event:', err);
            this.db.run('ROLLBACK');
            resolve(false);
            return;
          }
        });

        this.db.run(
          'INSERT OR REPLACE INTO deleted_events (id, deleted_at, synced_to_caldav) VALUES (?, CURRENT_TIMESTAMP, 0)',
          [eventId],
          err => {
            if (err) {
              console.error('Error tracking deleted event:', err);
              this.db.run('ROLLBACK');
              resolve(false);
            } else {
              this.db.run('COMMIT');
              resolve(true);
            }
          }
        );
      });
    });
  }

  /**
   * Get events with CalDAV metadata for sync operations
   */
  async getEventsWithMetadata(calendar?: string): Promise<
    Array<
      CalendarEvent & {
        calendar_path?: string;
        calendar_name?: string;
        caldav_filename?: string;
      }
    >
  > {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM events';
      const params: (string | number | null)[] = [];

      if (calendar) {
        query += ' WHERE calendar_name = ?';
        params.push(calendar);
      }

      query += ' ORDER BY date ASC';

      this.db.all(query, params, (err, rows: DatabaseEventRow[]) => {
        if (err) {
          reject(err);
          return;
        }

        const events = rows.map(row => {
          const event = this.rowToEvent(row);
          const result: CalendarEvent & {
            calendar_path?: string;
            calendar_name?: string;
            caldav_filename?: string;
          } = { ...event };
          
          if (row.calendar_path) result.calendar_path = row.calendar_path;
          if (row.calendar_name) result.calendar_name = row.calendar_name;
          if (row.caldav_filename) result.caldav_filename = row.caldav_filename;
          
          return result;
        });
        resolve(events);
      });
    });
  }

  private buildSaveEventsSQL(preserveMetadata: boolean): string {
    const baseColumns = `
      id, title, date, time, description, location, organizer,
      attendees, categories, priority, status, visibility, dtend,
      duration, rrule, created, last_modified, sequence, url,
      geo_lat, geo_lon, transparency, attachments, timezone, 
      caldav_filename, calendar_path, calendar_name, sync_status, 
      local_modified, synced_at, is_vacation
    `;

    const baseValues = `?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?`;

    if (preserveMetadata) {
      return `
        INSERT INTO events (${baseColumns}) 
        VALUES (${baseValues.replace('CURRENT_TIMESTAMP', 'COALESCE((SELECT synced_at FROM events WHERE id = ?), CURRENT_TIMESTAMP)')})
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
      `;
    }

    return `INSERT OR REPLACE INTO events (${baseColumns}) VALUES (${baseValues})`;
  }

  private executeEventTransaction(
    events: CalendarEvent[],
    sql: string,
    preserveMetadata: boolean
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(sql);

      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION', err => {
          if (err) {
            console.error('Failed to start transaction:', err);
            reject(err);
            return;
          }

          let hasError = false;
          let processedCount = 0;

          events.forEach(event => {
            const params = this.buildEventParams(event, preserveMetadata);

            stmt.run(params, err => {
              if (err) {
                console.error(`Failed to save event ${event.id}:`, err);
                hasError = true;
              }

              processedCount++;
              if (processedCount === events.length) {
                this.finalizeTransaction(hasError, resolve, reject);
              }
            });
          });

          stmt.finalize(err => {
            if (err) {
              console.error('Failed to finalize statement:', err);
            }
          });
        });
      });
    });
  }

  private buildEventParams(event: CalendarEvent, preserveMetadata: boolean): (string | number | null)[] {
    const params = [
      event.id,
      event.title,
      event.date,
      event.time,
      event.description ?? null,
      event.location ?? null,
      event.organizer ?? null,
      JSON.stringify(event.attendees || []),
      JSON.stringify(event.categories || []),
      event.priority ?? null,
      event.status ?? null,
      event.visibility ?? null,
      event.dtend ?? null,
      event.duration ?? null,
      event.rrule ?? null,
      event.created ?? null,
      event.lastModified ?? null,
      event.sequence ?? null,
      event.url ?? null,
      event.geo?.lat ?? null,
      event.geo?.lon ?? null,
      event.transparency ?? null,
      JSON.stringify(event.attachments || []),
      event.timezone ?? null,
      ((event as any).caldav_filename as string) || null,
      ((event as any).calendar_path as string) || null,
      ((event as any).calendar_name as string) || null,
      ((event as any).sync_status as string) || 'synced',
      ((event as any).local_modified as string) || null,
      'CURRENT_TIMESTAMP',
      event.isVacation ? 1 : 0
    ];

    if (preserveMetadata) {
      params.push(event.id); // For COALESCE query
    }

    return params;
  }

  private finalizeTransaction(
    hasError: boolean,
    resolve: () => void,
    reject: (error: Error) => void
  ): void {
    if (hasError) {
      this.db.run('ROLLBACK', rollbackErr => {
        if (rollbackErr) {
          console.error('Failed to rollback transaction:', rollbackErr);
        }
        reject(new Error('Transaction failed and was rolled back'));
      });
    } else {
      this.db.run('COMMIT', commitErr => {
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

  private buildEventsQuery(
    startDate?: Date,
    endDate?: Date,
    calendar?: string
  ): { query: string; params: (string | number | null)[] } {
    let query = 'SELECT * FROM events';
    const params: (string | number | null)[] = [];
    const whereConditions: string[] = [];

    if (startDate && endDate) {
      whereConditions.push('date >= ? AND date <= ?');
      params.push(startDate.toISOString(), endDate.toISOString());
    } else if (startDate) {
      whereConditions.push('date >= ?');
      params.push(startDate.toISOString());
    } else if (endDate) {
      whereConditions.push('date <= ?');
      params.push(endDate.toISOString());
    }

    if (calendar) {
      whereConditions.push('calendar_name = ?');
      params.push(calendar);
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    query += ' ORDER BY date ASC';

    return { query, params };
  }

  private buildMetadataUpdate(
    metadata: EventMetadata,
    eventId: string
  ): { updateParts: string[]; params: (string | number | null)[] } {
    const updateParts: string[] = [];
    const params: (string | number | null)[] = [];

    if (metadata.caldav_etag !== undefined) {
      updateParts.push('caldav_etag = ?');
      params.push(metadata.caldav_etag);
    }

    params.push(eventId);
    return { updateParts, params };
  }

  private rowToEvent(row: DatabaseEventRow): CalendarEvent {
    const event: CalendarEvent = {
      id: row.id,
      title: row.title,
      date: row.date,
      time: row.time,
      start: row.start || row.date,
      end: row.end || row.dtend || row.date,
    };

    if (row.description) event.description = row.description;
    if (row.location) event.location = row.location;
    if (row.organizer) event.organizer = row.organizer;
    if (row.attendees) event.attendees = JSON.parse(row.attendees);
    if (row.categories) event.categories = JSON.parse(row.categories);
    if (row.priority) event.priority = row.priority;
    if (row.status) event.status = row.status as 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
    if (row.visibility) event.visibility = row.visibility as 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL';
    if (row.dtend) event.dtend = row.dtend;
    if (row.duration) event.duration = row.duration;
    if (row.rrule) event.rrule = row.rrule;
    if (row.created) event.created = row.created;
    if (row.last_modified) event.lastModified = row.last_modified;
    if (row.sequence) event.sequence = row.sequence;
    if (row.url) event.url = row.url;
    if (row.geo_lat && row.geo_lon)
      event.geo = { lat: row.geo_lat, lon: row.geo_lon };
    if (row.transparency) event.transparency = row.transparency as 'OPAQUE' | 'TRANSPARENT';
    if (row.attachments) event.attachments = JSON.parse(row.attachments);
    if (row.timezone) event.timezone = row.timezone;
    if (row.is_vacation !== undefined)
      event.isVacation = Boolean(row.is_vacation);

    return event;
  }
}