import https from 'https';
import ical from 'node-ical';
import { CalendarEvent, CalDAVCredentials } from '../types/Calendar.js';
import { iCalendarGenerator } from '../utils/iCalendarGenerator.js';

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
              const event = parsedCal[k];
              if (event && event.type === 'VEVENT') {
                const startDate = (event as any).start
                  ? new Date((event as any).start)
                  : new Date();
                const endDate = (event as any).end
                  ? new Date((event as any).end)
                  : null;

                const calendarEvent: CalendarEvent = {
                  id: (event as any).uid || k,
                  title: (event as any).summary || 'No Title',
                  date: startDate.toISOString(),
                  time: startDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                };

                if ((event as any).description)
                  calendarEvent.description = (event as any).description;
                if ((event as any).location)
                  calendarEvent.location = (event as any).location;

                const organizer = this.parseOrganizer((event as any).organizer);
                if (organizer) calendarEvent.organizer = organizer;

                const attendees = this.parseAttendees((event as any).attendee);
                if (attendees) calendarEvent.attendees = attendees;

                const categories = this.parseCategories(
                  (event as any).categories
                );
                if (categories) calendarEvent.categories = categories;

                if ((event as any).priority)
                  calendarEvent.priority = (event as any).priority;

                const status = this.parseStatus((event as any).status);
                if (status) calendarEvent.status = status;

                const visibility = this.parseClass((event as any).class);
                if (visibility) calendarEvent.visibility = visibility;

                if (endDate) calendarEvent.dtend = endDate.toISOString();

                const duration = this.calculateDuration(startDate, endDate);
                if (duration) calendarEvent.duration = duration;

                if ((event as any).rrule)
                  calendarEvent.rrule = (event as any).rrule.toString();
                if ((event as any).created)
                  calendarEvent.created = new Date(
                    (event as any).created
                  ).toISOString();
                if ((event as any).lastmodified)
                  calendarEvent.lastModified = new Date(
                    (event as any).lastmodified
                  ).toISOString();
                if ((event as any).sequence)
                  calendarEvent.sequence = (event as any).sequence;
                if ((event as any).url) calendarEvent.url = (event as any).url;

                const geo = this.parseGeo((event as any).geo);
                if (geo) calendarEvent.geo = geo;

                const transparency = this.parseTransparency(
                  (event as any).transp
                );
                if (transparency) calendarEvent.transparency = transparency;

                const attachments = this.parseAttachments(
                  (event as any).attach
                );
                if (attachments) calendarEvent.attachments = attachments;

                if ((event as any).start && (event as any).start.tz)
                  calendarEvent.timezone = (event as any).start.tz;

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

  private parseOrganizer(organizer: any): string | undefined {
    if (typeof organizer === 'string') return organizer;
    if (organizer && organizer.val) return organizer.val;
    return undefined;
  }

  private parseAttendees(attendee: any): string[] | undefined {
    if (!attendee) return undefined;
    if (Array.isArray(attendee)) {
      return attendee
        .map(a => (typeof a === 'string' ? a : a.val || a.toString()))
        .filter(Boolean);
    }
    const single =
      typeof attendee === 'string'
        ? attendee
        : attendee.val || attendee.toString();
    return single ? [single] : undefined;
  }

  private parseCategories(categories: any): string[] | undefined {
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
    status: any
  ): 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED' | undefined {
    if (!status) return undefined;
    const statusStr = (
      typeof status === 'string' ? status : status.toString()
    ).toUpperCase();
    if (['CONFIRMED', 'TENTATIVE', 'CANCELLED'].includes(statusStr)) {
      return statusStr as 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
    }
    return undefined;
  }

  private parseClass(
    classField: any
  ): 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL' | undefined {
    if (!classField) return undefined;
    const classStr = (
      typeof classField === 'string' ? classField : classField.toString()
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

  private parseGeo(geo: any): { lat: number; lon: number } | undefined {
    if (!geo) return undefined;
    if (geo.lat && geo.lon)
      return { lat: parseFloat(geo.lat), lon: parseFloat(geo.lon) };
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

  private parseTransparency(transp: any): 'OPAQUE' | 'TRANSPARENT' | undefined {
    if (!transp) return undefined;
    const transpStr = (
      typeof transp === 'string' ? transp : transp.toString()
    ).toUpperCase();
    if (['OPAQUE', 'TRANSPARENT'].includes(transpStr)) {
      return transpStr as 'OPAQUE' | 'TRANSPARENT';
    }
    return undefined;
  }

  private parseAttachments(attach: any): string[] | undefined {
    if (!attach) return undefined;
    if (Array.isArray(attach)) {
      return attach
        .map(a => (typeof a === 'string' ? a : a.val || a.toString()))
        .filter(Boolean);
    }
    const single =
      typeof attach === 'string' ? attach : attach.val || attach.toString();
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
      console.log('Generated iCalendar data:', iCalData);

      // Apple CalDAV event URL format: /path/event-uid.ics
      // URL-encode the event ID to handle special characters
      const encodedEventId = encodeURIComponent(event.id);
      const eventUrl = `${this.credentials.path}${encodedEventId}.ics`;
      console.log('Raw Event ID for update:', event.id);
      console.log('Encoded Event ID for update:', encodedEventId);
      console.log('Attempting to update event at URL:', eventUrl);

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
      console.log('=== CalDAV PUT Request ===');
      console.log(
        'URL:',
        `https://${options.hostname}:${options.port}${options.path}`
      );
      console.log('Method:', options.method);
      console.log('Headers:', options.headers);
      console.log('Body Length:', Buffer.byteLength(iCalData));
      console.log('=========================');

      const req = https.request(options, res => {
        let data = '';

        // Log response headers
        console.log('Response Status:', res.statusCode, res.statusMessage);
        console.log('Response Headers:', res.headers);

        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          // Log full response body
          console.log('Response Body:', data);

          if (
            res.statusCode === 200 ||
            res.statusCode === 201 ||
            res.statusCode === 204
          ) {
            console.log(`Event ${event.id} updated successfully`);
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
      console.log('Raw Event ID:', eventId);
      console.log('Encoded Event ID:', encodedEventId);
      console.log('Attempting to delete event at URL:', eventUrl);

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

      console.log('=== CalDAV DELETE Request ===');
      console.log(
        'URL:',
        `https://${options.hostname}:${options.port}${options.path}`
      );
      console.log('Method:', options.method);
      console.log('=============================');

      const req = https.request(options, res => {
        let data = '';

        console.log(
          'Delete Response Status:',
          res.statusCode,
          res.statusMessage
        );
        console.log('Delete Response Headers:', res.headers);

        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          console.log('Delete Response Body:', data);

          if (
            res.statusCode === 200 ||
            res.statusCode === 204 ||
            res.statusCode === 404
          ) {
            // 404 is OK - event might already be deleted
            console.log(
              `Event ${eventId} deleted successfully (or already deleted)`
            );
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
      console.log('Generated iCalendar data for creation:', iCalData);

      // Use a simple UUID-based filename as recommended by Apple docs
      // Avoid special characters in URLs entirely
      const filename = `event-${Date.now()}-${Math.random().toString(36).substring(2, 15)}.ics`;
      const eventUrl = `${this.credentials.path}${filename}`;
      console.log('Raw Event ID for creation:', event.id);
      console.log('Filename for creation:', filename);
      console.log('Creating event at URL:', eventUrl);

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

      console.log('=== CalDAV CREATE Request ===');
      console.log(
        'URL:',
        `https://${options.hostname}:${options.port}${options.path}`
      );
      console.log('Method:', options.method);
      console.log('=============================');

      const req = https.request(options, res => {
        let data = '';

        console.log(
          'Create Response Status:',
          res.statusCode,
          res.statusMessage
        );
        console.log('Create Response Headers:', res.headers);

        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          console.log('Create Response Body:', data);

          if (
            res.statusCode === 200 ||
            res.statusCode === 201 ||
            res.statusCode === 204
          ) {
            console.log(`Event ${event.id} created successfully`);
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
