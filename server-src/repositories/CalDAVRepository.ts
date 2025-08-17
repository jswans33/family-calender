import https from 'https';
import ical from 'node-ical';
import { CalendarEvent, CalDAVCredentials } from '../types/Calendar.js';
import { iCalendarGenerator } from '../utils/iCalendarGenerator.js';

// Type interfaces for ical parsing
interface ICalEventData {
  uid?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: Date | { toISOString?: () => string; tz?: string };
  end?: Date | { toISOString?: () => string };
  organizer?: unknown;
  attendee?: unknown;
  categories?: unknown;
  priority?: number;
  status?: unknown;
  class?: unknown;
  rrule?: { toString?: () => string };
  created?: Date | { toISOString?: () => string };
  lastmodified?: Date | { toISOString?: () => string };
  sequence?: number;
  url?: string;
  geo?: unknown;
  transp?: unknown;
  attach?: unknown;
}

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

  // CODE_SMELL: Rule #4 Complexity Budget - Method exceeds 30 lines with nested logic
  // Fix: Split into extractMatches(), parseICalContent(), buildCalendarEvent()
  // CODE_SMELL: Rule #5 No Clever Code - Duplicate parsing logic with CalDAVMultiCalendarRepository
  // Fix: Extract shared ICalParser utility class
  parseCalendarEvents(xmlData: string): CalendarEvent[] {
    const events: CalendarEvent[] = [];

    try {
      const icalMatches = xmlData.match(
        /<calendar-data[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/calendar-data>/gi
      );

      if (icalMatches) {
        icalMatches.forEach(match => {
          const icalContent = match
            .replace(/<calendar-data[^>]*><!\[CDATA\[/, '')
            .replace(/\]\]><\/calendar-data>/, '');

          try {
            const parsedCal = ical.parseICS(icalContent);

            for (const k in parsedCal) {
              const event = parsedCal[k] as ICalEventData & { type?: string };
              if (event && event.type === 'VEVENT') {
                const startDate = event.start
                  ? new Date(event.start)
                  : new Date();
                const endDate = event.end ? new Date(event.end) : null;

                const calendarEvent: CalendarEvent = {
                  id: event.uid || k,
                  title: event.summary || 'No Title',
                  date: startDate.toISOString(),
                  time: startDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                };

                if (event.description)
                  calendarEvent.description = event.description;
                if (event.location) calendarEvent.location = event.location;

                const organizer = this.parseOrganizer(event.organizer);
                if (organizer) calendarEvent.organizer = organizer;

                const attendees = this.parseAttendees(event.attendee);
                if (attendees) calendarEvent.attendees = attendees;

                const categories = this.parseCategories(event.categories);
                if (categories) calendarEvent.categories = categories;

                if (event.priority) calendarEvent.priority = event.priority;

                const status = this.parseStatus(event.status);
                if (status) calendarEvent.status = status;

                const visibility = this.parseClass(event.class);
                if (visibility) calendarEvent.visibility = visibility;

                if (endDate) calendarEvent.dtend = endDate.toISOString();

                const duration = this.calculateDuration(startDate, endDate);
                if (duration) calendarEvent.duration = duration;

                if (event.rrule) calendarEvent.rrule = event.rrule.toString();
                if (event.created)
                  calendarEvent.created = new Date(event.created).toISOString();
                if (event.lastmodified)
                  calendarEvent.lastModified = new Date(
                    event.lastmodified
                  ).toISOString();
                if (event.sequence) calendarEvent.sequence = event.sequence;
                if (event.url) calendarEvent.url = event.url;

                const geo = this.parseGeo(event.geo);
                if (geo) calendarEvent.geo = geo;

                const transparency = this.parseTransparency(event.transp);
                if (transparency) calendarEvent.transparency = transparency;

                const attachments = this.parseAttachments(event.attach);
                if (attachments) calendarEvent.attachments = attachments;

                if (event.start && event.start.tz)
                  calendarEvent.timezone = event.start.tz;

                events.push(calendarEvent);
              }
            }
          } catch (parseError) {
            console.error('Error parsing iCal entry:', parseError);
          }
        });
      }
    } catch (error) {
      console.error('Error parsing CalDAV response:', error);
    }

    return events;
  }

  private parseOrganizer(organizer: unknown): string | undefined {
    if (typeof organizer === 'string') return organizer;
    if (
      organizer &&
      typeof organizer === 'object' &&
      organizer !== null &&
      'val' in organizer &&
      typeof (organizer as Record<string, unknown>).val === 'string'
    )
      return (organizer as Record<string, unknown>).val as string;
    return undefined;
  }

  private parseAttendees(attendee: unknown): string[] | undefined {
    if (!attendee) return undefined;
    if (Array.isArray(attendee)) {
      return attendee
        .map(a =>
          typeof a === 'string'
            ? a
            : (a as any)?.val || (a as any)?.toString() || ''
        )
        .filter(Boolean);
    }
    const single =
      typeof attendee === 'string'
        ? attendee
        : (attendee as any)?.val || (attendee as any)?.toString() || '';
    return single ? [single] : undefined;
  }

  private parseCategories(categories: unknown): string[] | undefined {
    if (!categories) return undefined;
    if (Array.isArray(categories)) return categories.filter(Boolean);
    if (typeof categories === 'string')
      return categories
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);
    return undefined;
  }

  private parseStatus(
    status: unknown
  ): 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED' | undefined {
    if (!status) return undefined;
    const statusStr = (
      typeof status === 'string' ? status : (status as any)?.toString() || ''
    ).toUpperCase();
    if (['CONFIRMED', 'TENTATIVE', 'CANCELLED'].includes(statusStr)) {
      return statusStr as 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
    }
    return undefined;
  }

  private parseClass(
    classField: unknown
  ): 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL' | undefined {
    if (!classField) return undefined;
    const classStr = (
      typeof classField === 'string'
        ? classField
        : (classField as any)?.toString() || ''
    ).toUpperCase();
    if (['PUBLIC', 'PRIVATE', 'CONFIDENTIAL'].includes(classStr)) {
      return classStr as 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL';
    }
    return undefined;
  }

  private calculateDuration(start: Date, end: Date | null): string | undefined {
    if (!end) return undefined;
    const durationMs = end.getTime() - start.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    return `PT${hours}H${minutes}M`;
  }

  private parseGeo(geo: unknown): { lat: number; lon: number } | undefined {
    if (!geo) return undefined;
    if ((geo as any)?.lat && (geo as any)?.lon)
      return {
        lat: parseFloat((geo as any)?.lat),
        lon: parseFloat((geo as any)?.lon),
      };
    if (typeof geo === 'string') {
      const parts = geo.split(',');
      if (parts.length === 2 && parts[0] && parts[1]) {
        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lon)) {
          return { lat, lon };
        }
      }
    }
    return undefined;
  }

  private parseTransparency(
    transp: unknown
  ): 'OPAQUE' | 'TRANSPARENT' | undefined {
    if (!transp) return undefined;
    const transpStr = (
      typeof transp === 'string' ? transp : (transp as any)?.toString() || ''
    ).toUpperCase();
    if (['OPAQUE', 'TRANSPARENT'].includes(transpStr)) {
      return transpStr as 'OPAQUE' | 'TRANSPARENT';
    }
    return undefined;
  }

  private parseAttachments(attach: unknown): string[] | undefined {
    if (!attach) return undefined;
    if (Array.isArray(attach)) {
      return attach
        .map(a =>
          typeof a === 'string'
            ? a
            : (a as any)?.val || (a as any)?.toString() || ''
        )
        .filter(Boolean);
    }
    const single =
      typeof attach === 'string'
        ? attach
        : (attach as any)?.val || (attach as any)?.toString() || '';
    return single ? [single] : undefined;
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
