import { CalendarEvent } from '../types/Calendar.js';
import { iCalendarGenerator } from '../utils/iCalendarGenerator.js';
import { CalDAVFetchRepository } from './CalDAVFetchRepository.js';

export class CalDAVOperationsRepository {
  private fetchRepository: CalDAVFetchRepository;
  private basePath: string;

  constructor(fetchRepository: CalDAVFetchRepository, basePath: string) {
    this.fetchRepository = fetchRepository;
    this.basePath = basePath;
  }

  async createEvent(event: CalendarEvent, calendar_path: string): Promise<boolean> {
    try {
      const iCalData = iCalendarGenerator.generateVCalendar(event);
      const filename = `${encodeURIComponent(event.id)}.ics`;
      const eventPath = `${this.basePath}${calendar_path}${filename}`;

      const result = await this.fetchRepository.putEventData(iCalData, eventPath);
      
      if (!result.success) {
        console.error(`❌ Failed to create event ${event.id}: ${result.statusCode}`);
      }
      
      return result.success;
    } catch (error) {
      console.error(`Error creating event ${event.id}:`, error);
      return false;
    }
  }

  async updateEvent(event: CalendarEvent, calendar_path: string): Promise<boolean> {
    try {
      const iCalData = iCalendarGenerator.generateVCalendar(event);
      const encodedEventId = encodeURIComponent(event.id);
      const eventPath = `${this.basePath}${calendar_path}${encodedEventId}.ics`;

      const result = await this.fetchRepository.putEventData(iCalData, eventPath);
      
      if (!result.success) {
        console.error(`❌ Failed to update event ${event.id}: ${result.statusCode}`);
      }
      
      return result.success;
    } catch (error) {
      console.error(`Error updating event ${event.id}:`, error);
      return false;
    }
  }

  async deleteEvent(
    eventId: string,
    calendar_path: string,
    filename: string
  ): Promise<boolean> {
    try {
      const eventPath = `${this.basePath}${calendar_path}${filename}`;
      const result = await this.fetchRepository.deleteEventData(eventPath);
      
      if (!result.success) {
        console.error(`❌ Failed to delete event ${eventId}: ${result.statusCode}`);
      }
      
      return result.success;
    } catch (error) {
      console.error(`Error deleting event ${eventId}:`, error);
      return false;
    }
  }

  async createEventInCalendar(event: CalendarEvent, calendarName: string): Promise<boolean> {
    try {
      const icalContent = this.generateICalendarContent(event);
      const eventPath = `${this.basePath}/${calendarName}/${event.id}.ics`;

      const result = await this.fetchRepository.putEventData(icalContent, eventPath);
      
      if (!result.success) {
        console.error(`❌ Failed to create event in ${calendarName}: ${result.statusCode}`);
      }
      
      return result.success;
    } catch (error) {
      console.error(`❌ Error creating event in ${calendarName}:`, error);
      return false;
    }
  }

  private generateICalendarContent(event: CalendarEvent): string {
    const now =
      new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const startDate =
      new Date(event.date + (event.time ? `T${event.time}:00` : ''))
        .toISOString()
        .replace(/[-:]/g, '')
        .split('.')[0] + 'Z';
    const endDate = event.dtend
      ? new Date(event.dtend).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
      : new Date(
          new Date(
            event.date + (event.time ? `T${event.time}:00` : '')
          ).getTime() + 3600000
        )
          .toISOString()
          .replace(/[-:]/g, '')
          .split('.')[0] + 'Z';

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Claude Code//Calendar//EN',
      'BEGIN:VEVENT',
      `UID:${event.id}`,
      `DTSTART:${startDate}`,
      `DTEND:${endDate}`,
      `DTSTAMP:${now}`,
      `SUMMARY:${event.title || 'Untitled Event'}`,
      event.description ? `DESCRIPTION:${event.description}` : '',
      event.location ? `LOCATION:${event.location}` : '',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .filter(Boolean)
      .join('\r\n');
  }
}