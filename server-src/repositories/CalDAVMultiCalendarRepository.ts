import { CalendarEvent, CalDAVCredentials } from '../types/Calendar.js';
import { CalendarConfigService } from '../services/CalendarConfigService.js';
import { CalDAVFetchRepository } from './CalDAVFetchRepository.js';
import { CalDAVParserRepository } from './CalDAVParserRepository.js';
import { CalDAVOperationsRepository } from './CalDAVOperationsRepository.js';

interface CalendarInfo {
  name: string;
  path: string;
  displayName: string;
  count: number;
}

interface EventWithMetadata extends CalendarEvent {
  calendar_path: string;
  calendar_name: string;
  caldav_filename: string;
}

export class CalDAVMultiCalendarRepository {
  private configService: CalendarConfigService;
  private fetchRepository: CalDAVFetchRepository;
  private parserRepository: CalDAVParserRepository;
  private operationsRepository: CalDAVOperationsRepository;

  constructor(credentials: CalDAVCredentials) {
    this.configService = new CalendarConfigService();
    const basePath = this.configService.getBasePath();

    this.fetchRepository = new CalDAVFetchRepository(credentials, basePath);
    this.parserRepository = new CalDAVParserRepository();
    this.operationsRepository = new CalDAVOperationsRepository(
      this.fetchRepository,
      basePath
    );
  }

  /**
   * Discovers all available calendars and their event counts
   */
  async getAllCalendars(): Promise<CalendarInfo[]> {
    const calendars = this.configService.getCalendars();

    for (const calendar of calendars) {
      try {
        const xmlData = await this.fetchRepository.fetchCalendarData(
          calendar.path
        );
        const events = this.parserRepository.parseCalendarEvents(xmlData);
        calendar.count = events.length;
      } catch (error) {
        console.error(`❌ Failed to fetch calendar "${calendar.name}":`, error);
        calendar.count = -1; // Indicates error
      }
    }

    return calendars;
  }

  /**
   * Fetches all events from all calendars with metadata
   */
  async getAllEventsFromAllCalendars(): Promise<EventWithMetadata[]> {
    const allEvents: EventWithMetadata[] = [];
    const calendars = this.configService.getCalendars();

    for (const calendar of calendars) {
      try {
        const xmlData = await this.fetchRepository.fetchCalendarData(
          calendar.path
        );
        const eventsWithFilenames =
          this.parserRepository.parseCalendarEventsWithFilenames(xmlData);

        const eventsWithMetadata: EventWithMetadata[] = eventsWithFilenames.map(
          item => ({
            ...item.event,
            calendar_path: calendar.path,
            calendar_name: calendar.name,
            caldav_filename: item.filename,
          })
        );

        allEvents.push(...eventsWithMetadata);
      } catch (error) {
        console.error(
          `❌ Failed to fetch events from ${calendar.name}:`,
          error
        );
      }
    }

    return allEvents;
  }

  /**
   * Fetch calendar data from specific calendar path
   */
  async fetchCalendarData(
    calendar_path: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<string> {
    return this.fetchRepository.fetchCalendarData(
      calendar_path,
      startDate,
      endDate
    );
  }

  /**
   * Parse calendar events (existing logic)
   */
  parseCalendarEvents(xmlData: string): CalendarEvent[] {
    return this.parserRepository.parseCalendarEvents(xmlData);
  }

  /**
   * Parse calendar events with filename extraction
   */
  parseCalendarEventsWithFilenames(
    xmlData: string
  ): { event: CalendarEvent; filename: string }[] {
    return this.parserRepository.parseCalendarEventsWithFilenames(xmlData);
  }

  /**
   * Create event in specific calendar
   */
  async createEvent(
    event: CalendarEvent,
    calendar_path: string
  ): Promise<boolean> {
    return this.operationsRepository.createEvent(event, calendar_path);
  }

  /**
   * Delete event from specific calendar using filename
   */
  async deleteEvent(
    eventId: string,
    calendar_path: string,
    filename: string
  ): Promise<boolean> {
    return this.operationsRepository.deleteEvent(
      eventId,
      calendar_path,
      filename
    );
  }

  /**
   * Update event in specific calendar
   */
  async updateEvent(
    event: CalendarEvent,
    calendar_path: string
  ): Promise<boolean> {
    return this.operationsRepository.updateEvent(event, calendar_path);
  }

  /**
   * Create event in specific calendar
   */
  async createEventInCalendar(
    event: CalendarEvent,
    calendarName: string
  ): Promise<boolean> {
    const calendar = this.configService.getCalendarByName(calendarName);
    if (!calendar) {
      return false;
    }

    return this.operationsRepository.createEventInCalendar(event, calendarName);
  }

  /**
   * Update event in calendar
   */
  async updateEventInCalendar(
    event: CalendarEvent,
    filename: string,
    calendar_path: string
  ): Promise<boolean> {
    const fullPath = `${calendar_path}${filename}`;
    return this.operationsRepository.updateEvent(event, fullPath);
  }

  /**
   * Delete event from calendar
   */
  async deleteEventFromCalendar(
    filename: string,
    calendar_path: string
  ): Promise<boolean> {
    return this.operationsRepository.deleteEvent(
      filename,
      calendar_path,
      filename
    );
  }
}
