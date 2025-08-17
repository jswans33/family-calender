import { CalDAVRepository } from '../repositories/CalDAVRepository.js';
import { CalDAVMultiCalendarRepository } from '../repositories/CalDAVMultiCalendarRepository.js';
import { SQLiteCompositeRepository } from '../repositories/SQLiteCompositeRepository.js';

/**
 * Service responsible for syncing calendar data between CalDAV and local database
 * Follows Rule #4: Max 3-5 public methods
 */
export class CalendarSyncService {
  private lastSyncTime: Date | null = null;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(
    private calDAVRepository: CalDAVRepository,
    private multiCalendarRepository: CalDAVMultiCalendarRepository,
    private sqliteRepository: SQLiteCompositeRepository,
    private syncIntervalMinutes: number = 15
  ) {}

  async startAutoSync(): Promise<void> {
    // Clear any existing interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Initial sync
    await this.performSync();

    // Set up interval for periodic sync
    this.syncInterval = setInterval(
      () => {
        this.performSync().catch(error => {
          console.error('Auto sync failed:', error);
        });
      },
      this.syncIntervalMinutes * 60 * 1000
    );
  }

  async performSync(): Promise<void> {
    try {
      // Sync deletions first
      await this.syncDeletionsToCalDAV();

      // Fetch events from all calendars
      const allEvents =
        await this.multiCalendarRepository.getAllEventsFromAllCalendars();

      // Transform events to include metadata
      const eventsWithMetadata = allEvents.map(event => ({
        ...event,
        caldav_filename: event.caldav_filename,
        calendar_path: event.calendar_path,
        calendar_name: event.calendar_name,
      }));

      // Save to database
      await this.sqliteRepository.saveEventsWithSmartSync(eventsWithMetadata);

      // Clean up old events
      await this.cleanupOldEvents();

      this.lastSyncTime = new Date();
      console.log(`Sync completed at ${this.lastSyncTime.toISOString()}`);
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private async syncDeletionsToCalDAV(): Promise<void> {
    // Get list of deleted event IDs
    const deletedEventIds = await this.sqliteRepository.getDeletedEventsToSync();
    if (deletedEventIds.length === 0) return;

    // Get full event data with metadata for deletion
    const allEvents = await this.sqliteRepository.getEventsWithMetadata();
    const deletedEvents = allEvents.filter(e => deletedEventIds.includes(e.id));

    for (const event of deletedEvents) {
      if (event.caldav_filename && event.calendar_path) {
        try {
          await this.multiCalendarRepository.deleteEventFromCalendar(
            event.caldav_filename,
            event.calendar_path
          );
          // Track that this deletion has been synced
          await this.sqliteRepository.trackRemoteDeletion(event.id);
        } catch (error) {
          console.error(`Failed to sync deletion for event ${event.id}:`, error);
        }
      }
    }
  }

  private async cleanupOldEvents(): Promise<void> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    await this.sqliteRepository.clearOldEvents(sixMonthsAgo);
  }
}