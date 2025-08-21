import { CalendarEvent } from '../types/Calendar.js';
import { SQLiteCompositeRepository } from '../repositories/SQLiteCompositeRepository.js';

/**
 * Service responsible for querying calendar events
 * Follows Rule #4: Max 3-5 public methods
 */
export class CalendarQueryService {
  constructor(private sqliteRepository: SQLiteCompositeRepository) {}

  async getEvents(
    startDate?: Date,
    endDate?: Date,
    calendar?: string
  ): Promise<CalendarEvent[]> {
    const events = await this.sqliteRepository.getEvents(
      startDate,
      endDate,
      calendar
    );
    return events.length > 0 ? events : this.getFallbackEvents();
  }

  async getEventsInRange(
    startDate: Date,
    endDate: Date,
    calendar?: string
  ): Promise<CalendarEvent[]> {
    return this.getEvents(startDate, endDate, calendar);
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
    const events = await this.sqliteRepository.getEventsWithMetadata(calendar);
    return events.length > 0 ? events : [];
  }

  async getCalendars(): Promise<Array<{ name: string; count: number }>> {
    try {
      const calendars = await this.sqliteRepository.getCalendarStats();
      if (!calendars || calendars.length === 0) {
        return [
          { name: 'personal', count: 0 },
          { name: 'work', count: 0 },
          { name: 'shared', count: 0 },
        ];
      }
      return calendars;
    } catch (error) {
      console.error('Error fetching calendars:', error);
      return [
        { name: 'personal', count: 0 },
        { name: 'work', count: 0 },
        { name: 'shared', count: 0 },
      ];
    }
  }

  private getFallbackEvents(): CalendarEvent[] {
    const now = new Date();
    const hourLater = new Date(Date.now() + 3600000);
    return [
      {
        id: 'fallback-1',
        title: 'No events available',
        date: now.toISOString(),
        time: now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        start: now.toISOString(),
        end: hourLater.toISOString(),
        description: 'Unable to fetch events. Please check your connection.',
      },
    ];
  }
}
