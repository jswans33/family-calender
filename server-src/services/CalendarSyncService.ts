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
      console.log('🔄 SYNC START - Performing CalDAV sync...');
      
      // Sync deletions first
      await this.syncDeletionsToCalDAV();

      console.log('📥 SYNC - Fetching events from CalDAV...');
      // Fetch events from all calendars
      const allEvents =
        await this.multiCalendarRepository.getAllEventsFromAllCalendars();
      
      console.log(`📥 SYNC - Retrieved ${allEvents.length} events from CalDAV`);

      // Get existing events to preserve original data
      console.log('🗃️ SYNC - Getting existing events to preserve original data...');
      const existingEvents = await this.sqliteRepository.getEventsWithMetadata();
      const existingEventsMap = new Map(existingEvents.map(e => [e.id, e]));

      // Transform events to include metadata and preserve original data
      const eventsWithMetadata = allEvents.map(event => {
        const existing = existingEventsMap.get(event.id);
        const enhanced = {
          ...event,
          caldav_filename: event.caldav_filename,
          calendar_path: event.calendar_path,
          calendar_name: event.calendar_name,
          // Preserve original data if it exists
          original_date: existing?.original_date || undefined,
          original_time: existing?.original_time || undefined,
          original_duration: existing?.original_duration || undefined,
          creation_source: existing?.creation_source || 'caldav',
          caldav_processed_at: new Date().toISOString()
        };
        
        // Debug specific events
        if (event.title?.includes('MD')) {
          console.log('🔍 SYNC DEBUG - Processing MD event:', {
            title: event.title,
            id: event.id,
            caldav_date: event.date,
            caldav_time: event.time,
            caldav_duration: event.duration,
            original_date: enhanced.original_date,
            original_time: enhanced.original_time,
            original_duration: enhanced.original_duration,
            creation_source: enhanced.creation_source
          });
        }
        
        return enhanced;
      });

      console.log('💾 SYNC - Saving events to database...');
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
    const deletedEventIds =
      await this.sqliteRepository.getDeletedEventsToSync();
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
          console.error(
            `Failed to sync deletion for event ${event.id}:`,
            error
          );
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
