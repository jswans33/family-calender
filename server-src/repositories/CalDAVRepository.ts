import https from 'https';
import { CalendarEvent, CalDAVCredentials } from '../types/Calendar.js';
import { iCalendarGenerator } from '../utils/iCalendarGenerator.js';
import { CalDAVParser } from '../utils/CalDAVParser.js';


export class CalDAVRepository {
  private credentials: CalDAVCredentials;

  constructor(credentials: CalDAVCredentials) {
    this.credentials = credentials;
  }

  async fetchCalendarData(startDate?: Date, endDate?: Date): Promise<string> {
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(
        `${this.credentials.username}:${this.credentials.password}`
      ).toString('base64');

      const timeRangeFilter = this.buildTimeRangeFilter(startDate, endDate);

      const postData = `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag />
    <C:calendar-data />
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">${timeRangeFilter}</C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

      const options: https.RequestOptions = {
        hostname: this.credentials.hostname,
        port: 443,
        path: this.credentials.path,
        method: 'REPORT',
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(postData),
          Depth: '1',
          Authorization: `Basic ${auth}`,
        },
      };

      const req = https.request(options, response => {
        let data = '';
        response.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        response.on('end', () => {
          resolve(data);
        });
      });

      req.on('error', (error: Error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Parse calendar events from CalDAV XML response
   * Follows Rule #4: Method under 30 lines, delegates to shared parser
   */
  parseCalendarEvents(xmlData: string): CalendarEvent[] {
    const events: CalendarEvent[] = [];

    try {
      const icalContents = CalDAVParser.extractICalContent(xmlData);
      
      icalContents.forEach(icalContent => {
        const parsedEvents = CalDAVParser.parseICalContent(icalContent);
        events.push(...parsedEvents);
      });
    } catch (error) {
      console.error('Error parsing CalDAV response:', error);
    }

    return events;
  }


  private buildTimeRangeFilter(startDate?: Date, endDate?: Date): string {
    if (!startDate && !endDate) return '';

    const start = startDate ? this.formatCalDAVDate(startDate) : '';
    const end = endDate ? this.formatCalDAVDate(endDate) : '';

    return `
        <C:time-range start="${start}" end="${end}" />`;
  }

  private formatCalDAVDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  /**
   * Updates an existing calendar event via CalDAV PUT operation
   * @param event Updated event data
   * @returns Promise<boolean> Success status
   */
  async updateEvent(event: CalendarEvent): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(
        `${this.credentials.username}:${this.credentials.password}`
      ).toString('base64');

      // Generate iCalendar data for the updated event
      const iCalData = iCalendarGenerator.generateVCalendar(event);

      // Apple CalDAV event URL format: /path/event-uid.ics
      // URL-encode the event ID to handle special characters
      const encodedEventId = encodeURIComponent(event.id);
      const eventUrl = `${this.credentials.path}${encodedEventId}.ics`;

      const options = {
        hostname: this.credentials.hostname,
        port: 443,
        path: eventUrl,
        method: 'PUT',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Length': Buffer.byteLength(iCalData),
          'User-Agent': 'Swanson-Light-Calendar/1.0',
        },
      };

      // Log the full request details

      const req = https.request(options, res => {
        let data = '';

        // Log response headers

        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          // Log full response body

          if (
            res.statusCode === 200 ||
            res.statusCode === 201 ||
            res.statusCode === 204
          ) {
            resolve(true);
          } else {
            console.error(
              `Failed to update event ${event.id}: ${res.statusCode} ${res.statusMessage}`
            );
            console.error('Full Response Body:', data);
            resolve(false);
          }
        });
      });

      req.on('error', error => {
        console.error(`Error updating event ${event.id}:`, error);
        reject(error);
      });

      req.write(iCalData);
      req.end();
    });
  }

  /**
   * Deletes a calendar event via CalDAV DELETE operation
   * @param eventId Event UID to delete
   * @returns Promise<boolean> Success status
   */
  async deleteEvent(eventId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(
        `${this.credentials.username}:${this.credentials.password}`
      ).toString('base64');

      // Apple CalDAV event URL format: /path/event-uid.ics
      // URL-encode the event ID to handle special characters like $ ( ) + @
      const encodedEventId = encodeURIComponent(eventId);
      const eventUrl = `${this.credentials.path}${encodedEventId}.ics`;

      const options = {
        hostname: this.credentials.hostname,
        port: 443,
        path: eventUrl,
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${auth}`,
          'User-Agent': 'Swanson-Light-Calendar/1.0',
        },
      };

      const req = https.request(options, res => {
        let data = '';

        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          if (
            res.statusCode === 200 ||
            res.statusCode === 204 ||
            res.statusCode === 404
          ) {
            // 404 is OK - event might already be deleted
            resolve(true);
          } else {
            console.error(
              `Failed to delete event ${eventId}: ${res.statusCode} ${res.statusMessage}`
            );
            resolve(false);
          }
        });
      });

      req.on('error', error => {
        console.error(`Error deleting event ${eventId}:`, error);
        reject(error);
      });

      req.end();
    });
  }

  /**
   * Creates a new calendar event via CalDAV PUT operation
   * @param event Event data to create
   * @returns Promise<boolean> Success status
   */
  async createEvent(event: CalendarEvent): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(
        `${this.credentials.username}:${this.credentials.password}`
      ).toString('base64');

      // Generate iCalendar data for the new event
      const iCalData = iCalendarGenerator.generateVCalendar(event);

      // Use event UID as filename for consistent deletion
      const filename = `${encodeURIComponent(event.id)}.ics`;
      const eventUrl = `${this.credentials.path}${filename}`;

      const options = {
        hostname: this.credentials.hostname,
        port: 443,
        path: eventUrl,
        method: 'PUT',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Length': Buffer.byteLength(iCalData),
          'User-Agent': 'Swanson-Light-Calendar/1.0',
          // Remove If-None-Match header as it causes 412 with Apple CalDAV
        },
      };

      const req = https.request(options, res => {
        let data = '';

        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          if (
            res.statusCode === 200 ||
            res.statusCode === 201 ||
            res.statusCode === 204
          ) {
            resolve(true);
          } else {
            console.error(
              `Failed to create event ${event.id}: ${res.statusCode} ${res.statusMessage}`
            );
            resolve(false);
          }
        });
      });

      req.on('error', error => {
        console.error(`Error creating event ${event.id}:`, error);
        reject(error);
      });

      req.write(iCalData);
      req.end();
    });
  }
}
