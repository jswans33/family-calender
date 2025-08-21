import { CalendarEvent } from '../types/Calendar.js';
import { SQLiteBaseRepository } from './SQLiteBaseRepository.js';

interface CalendarStatsRow {
  name: string;
  count: number;
}

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
  last_sync?: string;
}

/**
 * Repository for sync-related database operations
 * Handles CalDAV sync tracking and deleted events
 */
export class SQLiteSyncRepository extends SQLiteBaseRepository {
  /**
   * Get all event IDs from the events table
   */
  async getAllEventIds(): Promise<string[]> {
    return new Promise(resolve => {
      this.db.all(
        'SELECT id FROM events',
        [],
        (err, rows: DatabaseEventRow[]) => {
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
   * Check if an event was deleted locally
   */
  async isEventDeleted(eventId: string): Promise<boolean> {
    return new Promise(resolve => {
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
   * Track a remote deletion from CalDAV
   */
  async trackRemoteDeletion(eventId: string): Promise<void> {
    return new Promise(resolve => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        this.db.run('DELETE FROM events WHERE id = ?', [eventId], err => {
          if (err) {
            console.error('Error deleting event during remote deletion:', err);
            this.db.run('ROLLBACK');
            resolve();
            return;
          }
        });

        this.db.run(
          'INSERT OR REPLACE INTO deleted_events (id, deleted_at, synced_to_caldav) VALUES (?, CURRENT_TIMESTAMP, 1)',
          [eventId],
          err => {
            if (err) {
              console.error('Error tracking remote deletion:', err);
              this.db.run('ROLLBACK');
            } else {
              this.db.run('COMMIT');
            }
            resolve();
          }
        );
      });
    });
  }

  /**
   * Get deleted event IDs that need sync to CalDAV
   */
  async getDeletedEventsToSync(): Promise<string[]> {
    return new Promise(resolve => {
      this.db.all(
        'SELECT id FROM deleted_events WHERE synced_to_caldav = 0',
        [],
        (err, rows: DatabaseEventRow[]) => {
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
        err => {
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
   * Get events that need sync to CalDAV
   */
  async getPendingEvents(): Promise<CalendarEvent[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        "SELECT * FROM events WHERE sync_status = 'pending' ORDER BY local_modified ASC",
        [],
        (err, rows: DatabaseEventRow[]) => {
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
        err => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Get last sync time from events table
   */
  async getLastSyncTime(): Promise<Date | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT MAX(synced_at) as last_sync FROM events',
        (err, row: DatabaseEventRow) => {
          if (err) reject(err);
          else resolve(row?.last_sync ? new Date(row.last_sync) : null);
        }
      );
    });
  }

  /**
   * Clean up old deleted event records
   */
  async cleanupDeletedEvents(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        "DELETE FROM deleted_events WHERE deleted_at < datetime('now', '-30 days') AND synced_to_caldav = 1",
        [],
        err => {
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

  /**
   * Clear old events from database
   */
  async clearOldEvents(olderThan: Date): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM events WHERE synced_at < ?',
        [olderThan.toISOString()],
        err => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Get calendar statistics
   */
  async getCalendarStats(): Promise<Array<{ name: string; count: number }>> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT calendar_name as name, COUNT(*) as count FROM events WHERE calendar_name IS NOT NULL GROUP BY calendar_name ORDER BY count DESC',
        [],
        (err, rows: CalendarStatsRow[]) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows);
        }
      );
    });
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
    if (row.status)
      event.status = row.status as 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
    if (row.visibility)
      event.visibility = row.visibility as
        | 'PUBLIC'
        | 'PRIVATE'
        | 'CONFIDENTIAL';
    if (row.dtend) event.dtend = row.dtend;
    if (row.duration) event.duration = row.duration;
    if (row.rrule) event.rrule = row.rrule;
    if (row.created) event.created = row.created;
    if (row.last_modified) event.lastModified = row.last_modified;
    if (row.sequence) event.sequence = row.sequence;
    if (row.url) event.url = row.url;
    if (row.geo_lat && row.geo_lon)
      event.geo = { lat: row.geo_lat, lon: row.geo_lon };
    if (row.transparency)
      event.transparency = row.transparency as 'OPAQUE' | 'TRANSPARENT';
    if (row.attachments) event.attachments = JSON.parse(row.attachments);
    if (row.timezone) event.timezone = row.timezone;
    if (row.is_vacation !== undefined)
      event.isVacation = Boolean(row.is_vacation);

    return event;
  }
}
