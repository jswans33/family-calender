import { CalendarEvent, ICalendarService } from '../types/Calendar.js';
import { CalendarQueryService } from './CalendarQueryService.js';
import { CalendarSyncService } from './CalendarSyncService.js';
import { CalendarUpdateService } from './CalendarUpdateService.js';
import { CalDAVRepository } from '../repositories/CalDAVRepository.js';
import { CalDAVMultiCalendarRepository } from '../repositories/CalDAVMultiCalendarRepository.js';
import { SQLiteCompositeRepository } from '../repositories/SQLiteCompositeRepository.js';

/**
 * Facade service that coordinates the three specialized calendar services
 * Implements ICalendarService to maintain backward compatibility
 */
export class CalendarFacadeService implements ICalendarService {
  private queryService: CalendarQueryService;
  private syncService: CalendarSyncService;
  private updateService: CalendarUpdateService;

  constructor(
    calDAVRepository: CalDAVRepository,
    multiCalendarRepository: CalDAVMultiCalendarRepository,
    sqliteRepository: SQLiteCompositeRepository,
    syncIntervalMinutes: number = 15
  ) {
    this.queryService = new CalendarQueryService(sqliteRepository);
    this.syncService = new CalendarSyncService(
      calDAVRepository,
      multiCalendarRepository,
      sqliteRepository,
      syncIntervalMinutes
    );
    this.updateService = new CalendarUpdateService(
      multiCalendarRepository,
      sqliteRepository
    );

    // Initialize sync
    this.initializeSync(sqliteRepository);
  }

  private async initializeSync(sqliteRepository: SQLiteCompositeRepository): Promise<void> {
    try {
      if (sqliteRepository.ready) {
        await sqliteRepository.ready();
      }
      await this.syncService.startAutoSync();
    } catch (error) {
      console.error('Failed to initialize sync:', error);
    }
  }

  // Query methods delegated to CalendarQueryService
  async getEvents(
    startDate?: Date,
    endDate?: Date,
    calendar?: string
  ): Promise<CalendarEvent[]> {
    return this.queryService.getEvents(startDate, endDate, calendar);
  }

  async getTodaysEvents(): Promise<CalendarEvent[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return this.queryService.getEvents(today, tomorrow);
  }

  async getThisWeeksEvents(): Promise<CalendarEvent[]> {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    return this.queryService.getEvents(startOfWeek, endOfWeek);
  }

  async getThisMonthsEvents(): Promise<CalendarEvent[]> {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return this.queryService.getEvents(startOfMonth, endOfMonth);
  }

  async getEventsInRange(
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]> {
    return this.queryService.getEventsInRange(startDate, endDate);
  }

  async getEventsWithMetadata(calendar?: string): Promise<
    Array<
      CalendarEvent & {
        calendar_path?: string;
        calendar_name?: string;
        caldav_filename?: string;
      }
    >
  > {
    return this.queryService.getEventsWithMetadata(calendar);
  }

  async getCalendars(): Promise<Array<{ name: string; count: number }>> {
    return this.queryService.getCalendars();
  }

  // Update methods delegated to CalendarUpdateService
  async createEvent(event: CalendarEvent): Promise<boolean> {
    return this.updateService.createEvent(event);
  }

  async createEventInCalendar(
    event: CalendarEvent,
    calendarName: string
  ): Promise<boolean> {
    return this.updateService.createEvent(event, calendarName);
  }

  async updateEvent(event: CalendarEvent): Promise<boolean> {
    return this.updateService.updateEvent(event);
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    return this.updateService.deleteEvent(eventId);
  }

  // Sync methods delegated to CalendarSyncService
  async forceSync(): Promise<void> {
    return this.syncService.performSync();
  }

  async syncLocalToCalDAV(): Promise<void> {
    return this.syncService.performSync();
  }

  // Validation method (kept in facade as it's simple)
  validateEvent(event: unknown): event is CalendarEvent {
    if (!event || typeof event !== 'object') return false;
    const e = event as any;
    return (
      typeof e.id === 'string' &&
      typeof e.title === 'string' &&
      typeof e.start === 'string' &&
      typeof e.end === 'string'
    );
  }
}