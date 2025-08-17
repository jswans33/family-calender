import { CalendarEvent } from '../types/Calendar.js';
import { SQLiteEventRepository } from './SQLiteEventRepository.js';
import { SQLiteVacationRepository } from './SQLiteVacationRepository.js';
import { SQLiteSyncRepository } from './SQLiteSyncRepository.js';

interface EventMetadata {
  caldav_etag?: string;
  custom_data?: Record<string, unknown>;
}

/**
 * Composite repository that combines all focused repositories
 * Maintains backward compatibility with original SQLiteRepository interface
 */
export class SQLiteCompositeRepository {
  private eventRepo: SQLiteEventRepository;
  private vacationRepo: SQLiteVacationRepository;
  private syncRepo: SQLiteSyncRepository;

  constructor(dbPath: string = './calendar.db') {
    this.eventRepo = new SQLiteEventRepository(dbPath);
    this.vacationRepo = new SQLiteVacationRepository(dbPath);
    this.syncRepo = new SQLiteSyncRepository(dbPath);
  }

  async ready(): Promise<void> {
    await Promise.all([
      this.eventRepo.ready(),
      this.vacationRepo.ready(),
      this.syncRepo.ready()
    ]);
  }

  // Event repository methods
  async saveEvents(events: CalendarEvent[], preserveMetadata: boolean = false): Promise<void> {
    return this.eventRepo.saveEvents(events, preserveMetadata);
  }

  async getEvents(startDate?: Date, endDate?: Date, calendar?: string): Promise<CalendarEvent[]> {
    return this.eventRepo.getEvents(startDate, endDate, calendar);
  }

  async updateEventMetadata(eventId: string, metadata: EventMetadata): Promise<void> {
    return this.eventRepo.updateEventMetadata(eventId, metadata);
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    return this.eventRepo.deleteEvent(eventId);
  }

  async getEventsWithMetadata(calendar?: string): Promise<
    Array<CalendarEvent & { calendar_path?: string; calendar_name?: string; caldav_filename?: string; }>
  > {
    return this.eventRepo.getEventsWithMetadata(calendar);
  }

  // Vacation repository methods
  async getVacationBalances(): Promise<Array<{ user_name: string; balance_hours: number; last_updated: string }>> {
    return this.vacationRepo.getVacationBalances();
  }

  async getVacationBalance(userName: string): Promise<number> {
    return this.vacationRepo.getVacationBalance(userName);
  }

  async updateVacationBalance(userName: string, newBalance: number): Promise<void> {
    return this.vacationRepo.updateVacationBalance(userName, newBalance);
  }

  // Sync repository methods
  async getAllEventIds(): Promise<string[]> {
    return this.syncRepo.getAllEventIds();
  }

  async isEventDeleted(eventId: string): Promise<boolean> {
    return this.syncRepo.isEventDeleted(eventId);
  }

  async trackRemoteDeletion(eventId: string): Promise<void> {
    return this.syncRepo.trackRemoteDeletion(eventId);
  }

  async getDeletedEventsToSync(): Promise<string[]> {
    return this.syncRepo.getDeletedEventsToSync();
  }

  async markDeletedEventSynced(eventId: string): Promise<void> {
    return this.syncRepo.markDeletedEventSynced(eventId);
  }

  async getPendingEvents(): Promise<CalendarEvent[]> {
    return this.syncRepo.getPendingEvents();
  }

  async markEventSynced(eventId: string): Promise<void> {
    return this.syncRepo.markEventSynced(eventId);
  }

  async getLastSyncTime(): Promise<Date | null> {
    return this.syncRepo.getLastSyncTime();
  }

  async cleanupDeletedEvents(): Promise<void> {
    return this.syncRepo.cleanupDeletedEvents();
  }

  async clearOldEvents(olderThan: Date): Promise<void> {
    return this.syncRepo.clearOldEvents(olderThan);
  }

  async getCalendarStats(): Promise<Array<{ name: string; count: number }>> {
    return this.syncRepo.getCalendarStats();
  }

  // Composite method that uses multiple repositories
  async saveEventsWithSmartSync(events: CalendarEvent[]): Promise<void> {
    const caldavEventIds = new Set(events.map(e => e.id));
    const localEvents = await this.syncRepo.getAllEventIds();
    const missingFromCalDAV = localEvents.filter(id => !caldavEventIds.has(id));

    for (const eventId of missingFromCalDAV) {
      const isAlreadyDeleted = await this.syncRepo.isEventDeleted(eventId);
      if (!isAlreadyDeleted) {
        await this.syncRepo.trackRemoteDeletion(eventId);
      }
    }

    if (events.length === 0) return;

    const filteredEvents: CalendarEvent[] = [];
    for (const event of events) {
      const isDeleted = await this.syncRepo.isEventDeleted(event.id);
      if (!isDeleted) {
        filteredEvents.push(event);
      }
    }

    if (filteredEvents.length === 0) return;

    await this.eventRepo.saveEvents(filteredEvents, true);
  }

  close(): void {
    this.eventRepo.close();
    this.vacationRepo.close();
    this.syncRepo.close();
  }
}