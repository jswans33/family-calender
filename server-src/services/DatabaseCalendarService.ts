import { CalendarEvent, ICalendarService } from '../types/Calendar.js';
import { CalDAVRepository } from '../repositories/CalDAVRepository.js';
import { SQLiteRepository } from '../repositories/SQLiteRepository.js';

export class DatabaseCalendarService implements ICalendarService {
  private calDAVRepository: CalDAVRepository;
  private sqliteRepository: SQLiteRepository;
  private syncIntervalMinutes: number;

  constructor(
    calDAVRepository: CalDAVRepository,
    sqliteRepository: SQLiteRepository,
    syncIntervalMinutes: number = 15
  ) {
    this.calDAVRepository = calDAVRepository;
    this.sqliteRepository = sqliteRepository;
    this.syncIntervalMinutes = syncIntervalMinutes;

    // Wait for database initialization before starting sync
    this.sqliteRepository
      .ready()
      .then(() => {
        this.startBackgroundSync();
      })
      .catch(error => {
        console.error('Database initialization failed:', error);
      });
  }

  async getEvents(startDate?: Date, endDate?: Date): Promise<CalendarEvent[]> {
    try {
      const events = await this.sqliteRepository.getEvents(startDate, endDate);

      this.checkAndSync().catch(error => {
        console.error('Background sync failed:', error);
      });

      return events.length > 0 ? events : this.getFallbackEvents();
    } catch (error) {
      console.error('Error in DatabaseCalendarService.getEvents:', error);

      try {
        const xmlData = await this.calDAVRepository.fetchCalendarData(
          startDate,
          endDate
        );
        return this.calDAVRepository.parseCalendarEvents(xmlData);
      } catch (caldavError) {
        console.error('CalDAV fallback also failed:', caldavError);
        return this.getFallbackEvents();
      }
    }
  }

  async forceSync(): Promise<void> {
    console.log('Force syncing events from CalDAV to database...');

    try {
      // First, sync deletions to CalDAV
      await this.syncDeletionsToCalDAV();

      // Then fetch events from CalDAV
      const xmlData = await this.calDAVRepository.fetchCalendarData();
      const events = this.calDAVRepository.parseCalendarEvents(xmlData);

      // Use smart sync that filters out locally deleted events
      await this.sqliteRepository.saveEventsWithSmartSync(events);

      // Clean up old events
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      await this.sqliteRepository.clearOldEvents(sixMonthsAgo);

      // Clean up old deletion records
      await this.sqliteRepository.cleanupDeletedEvents();

      console.log(
        `Synced ${events.length} events to database (after filtering deletions)`
      );
    } catch (error) {
      console.error('Force sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync local deletions to CalDAV
   */
  private async syncDeletionsToCalDAV(): Promise<void> {
    try {
      const deletedEventIds =
        await this.sqliteRepository.getDeletedEventsToSync();
      console.log(
        `Found ${deletedEventIds.length} deleted events to sync to CalDAV`
      );

      for (const eventId of deletedEventIds) {
        try {
          await this.calDAVRepository.deleteEvent(eventId);
          await this.sqliteRepository.markDeletedEventSynced(eventId);
          console.log(`Deleted event ${eventId} from CalDAV`);
        } catch (error) {
          console.log(`Event ${eventId} may not exist in CalDAV:`, error);
          // Mark as synced anyway to avoid retrying
          await this.sqliteRepository.markDeletedEventSynced(eventId);
        }
      }
    } catch (error) {
      console.error('Failed to sync deletions to CalDAV:', error);
    }
  }

  private async checkAndSync(): Promise<void> {
    const lastSync = await this.sqliteRepository.getLastSyncTime();
    const now = new Date();

    const shouldSync =
      !lastSync ||
      now.getTime() - lastSync.getTime() > this.syncIntervalMinutes * 60 * 1000;

    if (shouldSync) {
      await this.forceSync();
    }
  }

  private startBackgroundSync(): void {
    this.checkAndSync().catch(error => {
      console.error('Initial sync failed:', error);
    });

    setInterval(
      () => {
        this.checkAndSync().catch(error => {
          console.error('Periodic sync failed:', error);
        });
      },
      this.syncIntervalMinutes * 60 * 1000
    );
  }

  async getTodaysEvents(): Promise<CalendarEvent[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    return this.getEvents(today, tomorrow);
  }

  async getThisWeeksEvents(): Promise<CalendarEvent[]> {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    return this.getEvents(startOfWeek, endOfWeek);
  }

  async getThisMonthsEvents(): Promise<CalendarEvent[]> {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    return this.getEvents(startOfMonth, endOfMonth);
  }

  async getEventsInRange(
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]> {
    return this.getEvents(startDate, endDate);
  }

  private getFallbackEvents(): CalendarEvent[] {
    return [
      {
        id: '1',
        title: 'No Calendar Access - Demo Event',
        date: new Date().toISOString(),
        time: '10:00 AM',
      },
    ];
  }

  validateEvent(event: any): event is CalendarEvent {
    return (
      typeof event === 'object' &&
      typeof event.id === 'string' &&
      typeof event.title === 'string' &&
      typeof event.date === 'string' &&
      typeof event.time === 'string'
    );
  }

  /**
   * Update an existing event locally and mark it for sync to CalDAV
   */
  async updateEvent(event: CalendarEvent): Promise<boolean> {
    try {
      // Mark as pending sync for reverse sync to CalDAV
      const eventWithStatus = {
        ...event,
        sync_status: 'pending',
        local_modified: new Date().toISOString(),
      };

      // Update in database (will replace the existing event)
      await this.sqliteRepository.saveEvents([eventWithStatus], false);
      console.log(`Event ${event.id} updated locally, marked for sync`);

      // Trigger reverse sync in background
      this.syncLocalToCalDAV().catch(error => {
        console.error('Background reverse sync failed:', error);
      });

      return true;
    } catch (error) {
      console.error('Failed to update event:', error);
      return false;
    }
  }

  /**
   * Create a new event locally and mark it for sync to CalDAV
   */
  async createEvent(event: CalendarEvent): Promise<boolean> {
    try {
      // Mark as pending sync
      const eventWithStatus = {
        ...event,
        sync_status: 'pending',
        local_modified: new Date().toISOString(),
      };

      await this.sqliteRepository.saveEvents([eventWithStatus], false);
      console.log(`Event ${event.id} created locally, marked for sync`);

      // Trigger reverse sync in background
      this.syncLocalToCalDAV().catch(error => {
        console.error('Background reverse sync failed:', error);
      });

      return true;
    } catch (error) {
      console.error('Failed to create event:', error);
      return false;
    }
  }

  /**
   * Delete an event from both local database and CalDAV
   */
  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      console.log(`Deleting event ${eventId}...`);

      // Delete from local database first
      const dbSuccess = await this.sqliteRepository.deleteEvent(eventId);

      if (!dbSuccess) {
        console.log(`Event ${eventId} not found in database`);
        return false;
      }

      // Try to delete from CalDAV (ignore errors if it doesn't exist there)
      try {
        await this.calDAVRepository.deleteEvent(eventId);
        console.log(`Event ${eventId} deleted from CalDAV`);
      } catch (caldavError) {
        console.log(
          `Event ${eventId} not found in CalDAV or delete failed:`,
          caldavError
        );
        // Still return success since we deleted from database
      }

      return true;
    } catch (error) {
      console.error('Failed to delete event:', error);
      return false;
    }
  }

  /**
   * Sync local pending events to CalDAV
   */
  async syncLocalToCalDAV(): Promise<void> {
    try {
      console.log('Starting reverse sync: Local → CalDAV');

      // Get pending events from database
      const pendingEvents = await this.sqliteRepository.getPendingEvents();
      console.log(`Found ${pendingEvents.length} pending events to sync`);

      for (const event of pendingEvents) {
        try {
          // Always try delete-then-create approach for all events
          // This works for both new and existing events
          console.log(`Syncing event ${event.id} to CalDAV`);

          // Try to delete if it exists (ignore errors)
          await this.calDAVRepository.deleteEvent(event.id).catch(() => {
            console.log(`Event ${event.id} not in CalDAV yet, will create`);
          });

          // Now create/recreate the event
          console.log(`Creating event ${event.id} in CalDAV...`);
          const success = await this.calDAVRepository.createEvent(event);

          if (success) {
            await this.sqliteRepository.markEventSynced(event.id);
            console.log(`Event ${event.id} synced to CalDAV successfully`);
          } else {
            console.error(`Failed to sync event ${event.id} to CalDAV`);
          }
        } catch (error) {
          console.error(`Error syncing event ${event.id}:`, error);
        }
      }

      console.log('Reverse sync completed');
    } catch (error) {
      console.error('Reverse sync failed:', error);
      throw error;
    }
  }
}
