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

    this.startBackgroundSync();
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
        const xmlData = await this.calDAVRepository.fetchCalendarData(startDate, endDate);
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
      const xmlData = await this.calDAVRepository.fetchCalendarData();
      const events = this.calDAVRepository.parseCalendarEvents(xmlData);

      await this.sqliteRepository.saveEvents(events);

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      await this.sqliteRepository.clearOldEvents(sixMonthsAgo);

      console.log(`Synced ${events.length} events to database`);
    } catch (error) {
      console.error('Force sync failed:', error);
      throw error;
    }
  }

  private async checkAndSync(): Promise<void> {
    const lastSync = await this.sqliteRepository.getLastSyncTime();
    const now = new Date();

    const shouldSync = !lastSync ||
      (now.getTime() - lastSync.getTime()) > (this.syncIntervalMinutes * 60 * 1000);

    if (shouldSync) {
      await this.forceSync();
    }
  }

  private startBackgroundSync(): void {
    this.checkAndSync().catch(error => {
      console.error('Initial sync failed:', error);
    });

    setInterval(() => {
      this.checkAndSync().catch(error => {
        console.error('Periodic sync failed:', error);
      });
    }, this.syncIntervalMinutes * 60 * 1000);
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

  async getEventsInRange(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    return this.getEvents(startDate, endDate);
  }

  private getFallbackEvents(): CalendarEvent[] {
    return [
      {
        id: '1',
        title: 'No Calendar Access - Demo Event',
        date: new Date().toISOString(),
        time: '10:00 AM'
      }
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
}