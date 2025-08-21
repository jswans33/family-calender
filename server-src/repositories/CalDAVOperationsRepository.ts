import { CalendarEvent } from '../types/Calendar.js';
import { iCalendarGenerator } from '../utils/iCalendarGenerator.js';
import { CalDAVFetchRepository } from './CalDAVFetchRepository.js';
import { debugLog } from '../config/debug.js';

export class CalDAVOperationsRepository {
  private fetchRepository: CalDAVFetchRepository;
  private basePath: string;

  constructor(fetchRepository: CalDAVFetchRepository, basePath: string) {
    this.fetchRepository = fetchRepository;
    this.basePath = basePath;
  }

  async createEvent(
    event: CalendarEvent,
    calendar_path: string
  ): Promise<boolean> {
    try {
      const iCalData = iCalendarGenerator.generateVCalendar(event);
      const filename = `${encodeURIComponent(event.id)}.ics`;
      const eventPath = `${this.basePath}${calendar_path}${filename}`;

      const result = await this.fetchRepository.putEventData(
        iCalData,
        eventPath
      );

      if (!result.success) {
        console.error(
          `❌ Failed to create event ${event.id}: ${result.statusCode}`
        );
      }

      return result.success;
    } catch (error) {
      console.error(`Error creating event ${event.id}:`, error);
      return false;
    }
  }

  async updateEvent(
    event: CalendarEvent,
    calendar_path: string
  ): Promise<boolean> {
    try {
      const iCalData = iCalendarGenerator.generateVCalendar(event);
      const encodedEventId = encodeURIComponent(event.id);
      const eventPath = `${this.basePath}${calendar_path}${encodedEventId}.ics`;

      const result = await this.fetchRepository.putEventData(
        iCalData,
        eventPath
      );

      if (!result.success) {
        console.error(
          `❌ Failed to update event ${event.id}: ${result.statusCode}`
        );
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
    console.log('🗑️ DELETE EVENT DEBUG:', {
      eventId,
      calendar_path,
      filename,
      basePath: this.basePath,
    });
    
    try {
      const eventPath = `${this.basePath}${calendar_path}${filename}`;
      console.log(`🗑️ Attempting to delete from CalDAV path: ${eventPath}`);
      
      // Log the full URL that will be used
      console.log('🗑️ Full deletion details:', {
        basePath: this.basePath,
        calendar_path,
        filename,
        fullPath: eventPath,
        isSharedCalendar: calendar_path.includes('2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E'),
      });
      
      const result = await this.fetchRepository.deleteEventData(eventPath);
      
      console.log('🗑️ CalDAV DELETE response:', {
        success: result.success,
        statusCode: result.statusCode,
        eventId,
        path: eventPath,
      });

      if (!result.success) {
        console.error(
          `❌ Failed to delete event ${eventId} from CalDAV: Status ${result.statusCode}`,
          {
            path: eventPath,
            calendar_path,
            filename,
            suggestion: 'Check if the event still exists in Apple Calendar',
          }
        );
      } else {
        console.log(`✅ Successfully deleted event ${eventId} from CalDAV`);
      }

      return result.success;
    } catch (error) {
      console.error(`❌ Error deleting event ${eventId}:`, error);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack');
      return false;
    }
  }

  async createEventInCalendar(
    event: CalendarEvent,
    calendarName: string
  ): Promise<boolean> {
    debugLog('caldav', `🔍 createEventInCalendar called with:`, {
      eventId: event.id,
      title: event.title,
      calendarName,
      start: event.start,
      end: event.end,
      date: event.date,
      time: event.time,
    });

    try {
      const icalContent = this.generateICalendarContent(event);
      debugLog(
        'caldav',
        `📝 Generated iCal content (first 200 chars):`,
        icalContent.substring(0, 200)
      );

      // Map calendar names to their actual paths
      const calendarPaths: Record<string, string> = {
        personal: 'home', // Using 'home' path
        work: 'work', // Using 'work' path
        shared: '2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E', // This is the actual shared calendar
        home: 'home',
        meals:
          '1fa1e4097e27af6d41607163c20c088e70cf8e9db9d71b1a62611ec364123914',
      };
      const calendarId = calendarPaths[calendarName] || calendarPaths.shared;
      const eventPath = `${this.basePath}/${calendarId}/${event.id}.ics`;
      debugLog('caldav', `📍 Event path: ${eventPath}`);

      const result = await this.fetchRepository.putEventData(
        icalContent,
        eventPath
      );
      debugLog('caldav', `📤 PUT result:`, {
        success: result.success,
        statusCode: result.statusCode,
      });

      if (!result.success) {
        console.error(
          `❌ Failed to create event in ${calendarName}: Status ${result.statusCode}`,
          {
            path: eventPath,
            contentLength: icalContent.length,
          }
        );
      }

      return result.success;
    } catch (error) {
      console.error(`❌ Error creating event in ${calendarName}:`, error);
      console.error(
        `Stack trace:`,
        error instanceof Error ? error.stack : 'No stack'
      );
      return false;
    }
  }

  private generateICalendarContent(event: CalendarEvent): string {
    const now =
      new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    // Use start/end fields if available, otherwise fall back to date/time
    const startDate = event.start
      ? new Date(event.start).toISOString().replace(/[-:]/g, '').split('.')[0] +
        'Z'
      : new Date(event.date + (event.time ? `T${event.time}:00` : ''))
          .toISOString()
          .replace(/[-:]/g, '')
          .split('.')[0] + 'Z';

    const endDate = event.end
      ? new Date(event.end).toISOString().replace(/[-:]/g, '').split('.')[0] +
        'Z'
      : event.dtend
        ? new Date(event.dtend)
            .toISOString()
            .replace(/[-:]/g, '')
            .split('.')[0] + 'Z'
        : new Date(
            new Date(
              event.start ||
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
