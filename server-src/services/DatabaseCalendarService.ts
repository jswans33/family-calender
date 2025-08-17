import { CalendarEvent, ICalendarService } from '../types/Calendar.js';
import { CalDAVRepository } from '../repositories/CalDAVRepository.js';
import { CalDAVMultiCalendarRepository } from '../repositories/CalDAVMultiCalendarRepository.js';
import { SQLiteCompositeRepository } from '../repositories/SQLiteCompositeRepository.js';

// CODE_SMELL: Rule #4 Complexity Budget - Service has 19 public methods (exceeds 3-5 limit)
// Fix: Split into CalendarSyncService, CalendarQueryService, and CalendarUpdateService
export class DatabaseCalendarService implements ICalendarService {
  private calDAVRepository: CalDAVRepository;
  private multiCalendarRepository: CalDAVMultiCalendarRepository;
  private sqliteRepository: SQLiteCompositeRepository;
  private syncIntervalMinutes: number;

  constructor(
    calDAVRepository: CalDAVRepository,
    multiCalendarRepository: CalDAVMultiCalendarRepository,
    sqliteRepository: SQLiteCompositeRepository,
    syncIntervalMinutes: number = 15
  ) {
    this.calDAVRepository = calDAVRepository;
    this.multiCalendarRepository = multiCalendarRepository;
    this.sqliteRepository = sqliteRepository;
    this.syncIntervalMinutes = syncIntervalMinutes;

    // Wait for database initialization before starting sync
    if (this.sqliteRepository.ready) {
      this.sqliteRepository
        .ready()
        .then(() => {
          this.startBackgroundSync();
        })
        .catch(error => {
          console.error('Database initialization failed:', error);
        });
    } else {
      // Start background sync immediately if ready method not available
      this.startBackgroundSync();
    }
  }

  async getEvents(
    startDate?: Date,
    endDate?: Date,
    calendar?: string
  ): Promise<CalendarEvent[]> {
    try {
      const events = await this.sqliteRepository.getEvents(
        startDate,
        endDate,
        calendar
      );

      // CODE_SMELL: Rule #1 One Thing Per File - Service doing background sync scheduling
      // Fix: Move background sync to dedicated SyncSchedulerService
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

  // CODE_SMELL: Rule #4 Complexity Budget - Method exceeds 30 lines
  // Fix: Split into syncDeletions(), fetchAndTransformEvents(), saveEvents(), cleanup()
  async forceSync(): Promise<void> {
    try {
      // First, sync deletions to CalDAV
      await this.syncDeletionsToCalDAV();

      // Fetch events from all calendars using multi-calendar repository
      const allEvents =
        await this.multiCalendarRepository.getAllEventsFromAllCalendars();

      // Transform events to include calendar metadata
      const eventsWithMetadata = allEvents.map(event => ({
        ...event,
        caldav_filename: event.caldav_filename,
        calendar_path: event.calendar_path,
        calendar_name: event.calendar_name,
      }));

      // Use smart sync that filters out locally deleted events
      await this.sqliteRepository.saveEventsWithSmartSync(eventsWithMetadata);

      // Clean up old events
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      await this.sqliteRepository.clearOldEvents(sixMonthsAgo);

      // Clean up old deletion records
      await this.sqliteRepository.cleanupDeletedEvents();
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

      for (const eventId of deletedEventIds) {
        try {
          await this.calDAVRepository.deleteEvent(eventId);
          await this.sqliteRepository.markDeletedEventSynced(eventId);
        } catch {
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
    const now = new Date();
    const later = new Date(now.getTime() + 3600000);
    return [
      {
        id: '1',
        title: 'No Calendar Access - Demo Event',
        date: now.toISOString(),
        time: '10:00 AM',
        start: now.toISOString(),
        end: later.toISOString(),
      },
    ];
  }

  validateEvent(event: unknown): event is CalendarEvent {
    return (
      typeof event === 'object' &&
      event !== null &&
      typeof (event as any).id === 'string' &&
      typeof (event as any).title === 'string' &&
      typeof (event as any).date === 'string' &&
      typeof (event as any).time === 'string'
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
      // First, get the event details from database to extract calendar metadata
      const eventsWithMetadata =
        await this.sqliteRepository.getEventsWithMetadata();
      const eventToDelete = eventsWithMetadata.find(e => e.id === eventId);

      if (!eventToDelete) {
        return false;
      }

      // Delete from local database first
      const dbSuccess = await this.sqliteRepository.deleteEvent(eventId);
      if (!dbSuccess) {
        return false;
      }

      // Delete from CalDAV using correct calendar path and filename
      try {
        if (eventToDelete.calendar_path && eventToDelete.caldav_filename) {
          await this.multiCalendarRepository.deleteEvent(
            eventId,
            eventToDelete.calendar_path,
            eventToDelete.caldav_filename
          );
        } else {
        }
      } catch (caldavError) {
        console.error(
          `Failed to delete event ${eventId} from CalDAV:`,
          caldavError
        );
        // Don't fail the whole operation if CalDAV delete fails
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
      // Get pending events from database
      const pendingEvents = await this.sqliteRepository.getPendingEvents();

      for (const event of pendingEvents) {
        try {
          // Always try delete-then-create approach for all events
          // This works for both new and existing events

          // Try to delete if it exists (ignore errors)
          await this.calDAVRepository.deleteEvent(event.id).catch(() => {});

          // Now create/recreate the event
          const success = await this.calDAVRepository.createEvent(event);

          if (success) {
            await this.sqliteRepository.markEventSynced(event.id);
          } else {
            console.error(`Failed to sync event ${event.id} to CalDAV`);
          }
        } catch (error) {
          console.error(`Error syncing event ${event.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Reverse sync failed:', error);
      throw error;
    }
  }

  /**
   * Get available calendars with event counts
   */
  async getCalendars(): Promise<Array<{ name: string; count: number }>> {
    try {
      return await this.sqliteRepository.getCalendarStats();
    } catch (error) {
      console.error('Error getting calendar stats:', error);
      // Fallback to multi-calendar repository
      try {
        return await this.multiCalendarRepository.getAllCalendars();
      } catch (fallbackError) {
        console.error('Calendar discovery fallback failed:', fallbackError);
        return [];
      }
    }
  }

  /**
   * Get events with calendar metadata
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
    try {
      return await this.sqliteRepository.getEventsWithMetadata(calendar);
    } catch (error) {
      console.error('Error getting events with metadata:', error);
      return [];
    }
  }

  /**
   * Create event in specific calendar
   */
  async createEventInCalendar(
    event: CalendarEvent,
    calendarName: string
  ): Promise<boolean> {
    try {
      // Use the multi-calendar repository to create in specific calendar
      const success = await this.multiCalendarRepository.createEventInCalendar(
        event,
        calendarName
      );

      if (success) {
        // Also save to database with calendar metadata
        const eventWithMetadata = {
          ...event,
          calendar_name: calendarName,
          calendar_path: this.getCalendarPath(calendarName),
          caldav_filename: `${event.id}.ics`,
          sync_status: 'synced',
          local_modified: new Date().toISOString(),
        };

        await this.sqliteRepository.saveEvents([eventWithMetadata], false);
        return true;
      } else {
        console.error(
          `Failed to create event ${event.id} in ${calendarName} calendar`
        );
        return false;
      }
    } catch (error) {
      console.error(`Error creating event in ${calendarName} calendar:`, error);
      return false;
    }
  }

  // CODE_SMELL: Rule #5 No Clever Code - Hard-coded calendar paths in service
  // Fix: Move to CalendarPathConfigService or configuration file
  private getCalendarPath(calendarName: string): string {
    const paths = {
      home: '/home/',
      work: '/work/',
      shared: '/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/',
      meals:
        '/1fa1e4097e27af6d41607163c20c088e70cf8e9db9d71b1a62611ec364123914/',
    };
    return (
      paths[calendarName as keyof typeof paths] ||
      '/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/'
    );
  }
}
