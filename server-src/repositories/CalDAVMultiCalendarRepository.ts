import https from 'https';
import ical from 'node-ical';
import fs from 'fs';
import path from 'path';
import { CalendarEvent, CalDAVCredentials } from '../types/Calendar.js';
import { iCalendarGenerator } from '../utils/iCalendarGenerator.js';

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
  private credentials: CalDAVCredentials;
  private readonly basePath: string;
  private readonly calendars: CalendarInfo[] = [
    {
      name: 'shared',
      path: '/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/',
      displayName: 'Shared',
      count: 0,
    },
    {
      name: 'home',
      path: '/home/',
      displayName: 'Home',
      count: 0,
    },
    {
      name: 'work',
      path: '/work/',
      displayName: 'Work',
      count: 0,
    },
    {
      name: 'meals',
      path: '/1fa1e4097e27af6d41607163c20c088e70cf8e9db9d71b1a62611ec364123914/',
      displayName: 'Meals',
      count: 0,
    },
  ];

  constructor(credentials: CalDAVCredentials) {
    this.credentials = credentials;
    // Extract base path from credentials (remove calendar-specific part)
    this.basePath = '/1110188709/calendars';
  }

  /**
   * QUALITY CHECK: Discovers all available calendars and their event counts
   */
  async getAllCalendars(): Promise<CalendarInfo[]> {
    console.log('🔍 Discovering all CalDAV calendars...');

    for (const calendar of this.calendars) {
      try {
        const xmlData = await this.fetchCalendarData(calendar.path);
        const events = this.parseCalendarEvents(xmlData);
        calendar.count = events.length;
        console.log(
          `✅ Calendar "${calendar.displayName}" (${calendar.name}): ${calendar.count} events`
        );
      } catch (error) {
        console.error(`❌ Failed to fetch calendar "${calendar.name}":`, error);
        calendar.count = -1; // Indicates error
      }
    }

    const totalEvents = this.calendars
      .filter(cal => cal.count >= 0)
      .reduce((sum, cal) => sum + cal.count, 0);

    console.log(`📊 Total events across all calendars: ${totalEvents}`);

    return this.calendars;
  }

  /**
   * QUALITY CHECK: Fetches all events from all calendars with metadata
   */
  async getAllEventsFromAllCalendars(): Promise<EventWithMetadata[]> {
    console.log('📅 Fetching all events from all calendars...');

    const allEvents: EventWithMetadata[] = [];

    for (const calendar of this.calendars) {
      try {
        console.log(
          `🔄 Fetching events from ${calendar.displayName} calendar...`
        );
        const xmlData = await this.fetchCalendarData(calendar.path);
        const eventsWithFilenames =
          this.parseCalendarEventsWithFilenames(xmlData);

        const eventsWithMetadata: EventWithMetadata[] = eventsWithFilenames.map(
          item => ({
            ...item.event,
            calendar_path: calendar.path,
            calendar_name: calendar.name,
            caldav_filename: item.filename,
          })
        );

        allEvents.push(...eventsWithMetadata);
        console.log(
          `✅ Fetched ${eventsWithMetadata.length} events from ${calendar.displayName}`
        );

        // QUALITY CHECK: Save events to intermediate file
        await this.saveEventsToFile(calendar.name, eventsWithMetadata);
      } catch (error) {
        console.error(
          `❌ Failed to fetch events from ${calendar.name}:`,
          error
        );
      }
    }

    console.log(`📊 Total events fetched: ${allEvents.length}`);

    // QUALITY CHECK: Save all events to master file
    await this.saveAllEventsToFile(allEvents);

    return allEvents;
  }

  /**
   * QUALITY CHECK: Save events to local file for verification
   */
  private async saveEventsToFile(
    calendarName: string,
    events: EventWithMetadata[]
  ): Promise<void> {
    const outputDir = path.join(process.cwd(), 'data', 'caldav-exports');

    // Ensure directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = path.join(outputDir, `${calendarName}-events.json`);
    const data = {
      calendar: calendarName,
      exported_at: new Date().toISOString(),
      event_count: events.length,
      events: events.map(event => ({
        id: event.id,
        title: event.title,
        date: event.date,
        time: event.time,
        calendar_path: event.calendar_path,
        calendar_name: event.calendar_name,
        caldav_filename: event.caldav_filename,
        description: event.description,
        location: event.location,
        dtend: event.dtend,
      })),
    };

    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(
      `💾 Saved ${events.length} events from ${calendarName} to: ${filename}`
    );
  }

  /**
   * QUALITY CHECK: Save all events to master file
   */
  private async saveAllEventsToFile(
    allEvents: EventWithMetadata[]
  ): Promise<void> {
    const outputDir = path.join(process.cwd(), 'data', 'caldav-exports');
    const filename = path.join(outputDir, 'all-calendars-events.json');

    const data = {
      exported_at: new Date().toISOString(),
      total_events: allEvents.length,
      calendars: this.calendars.map(cal => ({
        name: cal.name,
        displayName: cal.displayName,
        path: cal.path,
        count: allEvents.filter(e => e.calendar_name === cal.name).length,
      })),
      events: allEvents.map(event => ({
        id: event.id,
        title: event.title,
        date: event.date,
        time: event.time,
        calendar_path: event.calendar_path,
        calendar_name: event.calendar_name,
        caldav_filename: event.caldav_filename,
        description: event.description,
        location: event.location,
        dtend: event.dtend,
      })),
    };

    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(
      `💾 Saved ALL ${allEvents.length} events to master file: ${filename}`
    );

    // QUALITY CHECK: Generate summary report
    this.generateSummaryReport(data);
  }

  /**
   * QUALITY CHECK: Generate summary report
   */
  private generateSummaryReport(data: any): void {
    console.log('\n📋 === CALDAV EXPORT SUMMARY REPORT ===');
    console.log(`Export Time: ${data.exported_at}`);
    console.log(`Total Events: ${data.total_events}`);
    console.log('\nCalendar Breakdown:');

    data.calendars.forEach((cal: any) => {
      console.log(`  📅 ${cal.displayName}: ${cal.count} events`);
    });

    console.log('\n✅ Quality Checks:');

    // Check for missing metadata
    const eventsWithMissingData = data.events.filter(
      (e: any) => !e.calendar_path || !e.calendar_name || !e.caldav_filename
    );

    if (eventsWithMissingData.length === 0) {
      console.log(
        '  ✅ All events have complete metadata (calendar_path, calendar_name, caldav_filename)'
      );
    } else {
      console.log(
        `  ❌ ${eventsWithMissingData.length} events missing metadata`
      );
    }

    // Check for duplicate IDs
    const eventIds = data.events.map((e: any) => e.id);
    const uniqueIds = new Set(eventIds);

    if (eventIds.length === uniqueIds.size) {
      console.log('  ✅ All event IDs are unique');
    } else {
      console.log(
        `  ❌ Found ${eventIds.length - uniqueIds.size} duplicate event IDs`
      );
    }

    // Check filename patterns
    const filenamePatterns = data.events.map((e: any) => e.caldav_filename);
    const icsFiles = filenamePatterns.filter(
      (f: string) => f && f.endsWith('.ics')
    );

    console.log(
      `  📁 ${icsFiles.length}/${data.total_events} events have .ics filenames`
    );

    console.log('=== END SUMMARY REPORT ===\n');
  }

  /**
   * Fetch calendar data from specific calendar path
   */
  async fetchCalendarData(
    calendar_path: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<string> {
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
        path: `${this.basePath}${calendar_path}`, // FULL PATH: /1110188709/calendars + calendar_path
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
   * Parse calendar events with filename extraction
   */
  parseCalendarEventsWithFilenames(
    xmlData: string
  ): { event: CalendarEvent; filename: string }[] {
    const results: { event: CalendarEvent; filename: string }[] = [];

    try {
      // Extract responses from XML
      const responseMatches = xmlData.match(
        /<response[^>]*>([\s\S]*?)<\/response>/gi
      );

      if (responseMatches) {
        responseMatches.forEach(responseBlock => {
          try {
            // Extract filename from href
            const hrefMatch = responseBlock.match(/<href[^>]*>(.*?)<\/href>/i);
            let filename = '';

            if (hrefMatch && hrefMatch[1]) {
              const href = hrefMatch[1];
              const filenamePart = href.split('/').pop();
              if (filenamePart && filenamePart.endsWith('.ics')) {
                filename = filenamePart;
              }
            }

            // Extract calendar data
            const calendarDataMatch = responseBlock.match(
              /<calendar-data[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/calendar-data>/i
            );

            if (calendarDataMatch && calendarDataMatch[1]) {
              const icalContent = calendarDataMatch[1];

              try {
                const parsedCal = ical.parseICS(icalContent);

                for (const k in parsedCal) {
                  const event = parsedCal[k];
                  if (event && event.type === 'VEVENT') {
                    const calendarEvent = this.parseEventFromIcal(event, k);
                    results.push({
                      event: calendarEvent,
                      filename: filename || `${calendarEvent.id}.ics`,
                    });
                  }
                }
              } catch (parseError) {
                console.error('Error parsing iCal entry:', parseError);
              }
            }
          } catch (responseError) {
            console.error('Error parsing response block:', responseError);
          }
        });
      }
    } catch (error) {
      console.error('Error parsing CalDAV response:', error);
    }

    return results;
  }

  /**
   * Parse calendar events (existing logic)
   */
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
                const calendarEvent = this.parseEventFromIcal(event, k);
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

  /**
   * Parse individual event from iCal data
   */
  private parseEventFromIcal(event: any, k: string): CalendarEvent {
    const startDate = (event as any).start
      ? new Date((event as any).start)
      : new Date();
    const endDate = (event as any).end ? new Date((event as any).end) : null;

    const calendarEvent: CalendarEvent = {
      id: (event as any).uid || k,
      title: (event as any).summary || 'No Title',
      date: startDate.toISOString(),
      time: startDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    // Add optional fields
    if ((event as any).description)
      calendarEvent.description = (event as any).description;
    if ((event as any).location)
      calendarEvent.location = (event as any).location;
    if (endDate) calendarEvent.dtend = endDate.toISOString();

    // Add all other metadata fields from original parser
    const organizer = this.parseOrganizer((event as any).organizer);
    if (organizer) calendarEvent.organizer = organizer;

    const attendees = this.parseAttendees((event as any).attendee);
    if (attendees) calendarEvent.attendees = attendees;

    const categories = this.parseCategories((event as any).categories);
    if (categories) calendarEvent.categories = categories;

    if ((event as any).priority)
      calendarEvent.priority = (event as any).priority;

    const status = this.parseStatus((event as any).status);
    if (status) calendarEvent.status = status;

    const visibility = this.parseClass((event as any).class);
    if (visibility) calendarEvent.visibility = visibility;

    const duration = this.calculateDuration(startDate, endDate);
    if (duration) calendarEvent.duration = duration;

    if ((event as any).rrule)
      calendarEvent.rrule = (event as any).rrule.toString();
    if ((event as any).created)
      calendarEvent.created = new Date((event as any).created).toISOString();
    if ((event as any).lastmodified)
      calendarEvent.lastModified = new Date(
        (event as any).lastmodified
      ).toISOString();
    if ((event as any).sequence)
      calendarEvent.sequence = (event as any).sequence;
    if ((event as any).url) calendarEvent.url = (event as any).url;

    const geo = this.parseGeo((event as any).geo);
    if (geo) calendarEvent.geo = geo;

    const transparency = this.parseTransparency((event as any).transp);
    if (transparency) calendarEvent.transparency = transparency;

    const attachments = this.parseAttachments((event as any).attach);
    if (attachments) calendarEvent.attachments = attachments;

    if ((event as any).start && (event as any).start.tz)
      calendarEvent.timezone = (event as any).start.tz;

    return calendarEvent;
  }

  /**
   * Create event in specific calendar
   */
  async createEvent(
    event: CalendarEvent,
    calendar_path: string
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(
        `${this.credentials.username}:${this.credentials.password}`
      ).toString('base64');

      const iCalData = iCalendarGenerator.generateVCalendar(event);
      const filename = `${encodeURIComponent(event.id)}.ics`;
      const eventUrl = `${this.basePath}${calendar_path}${filename}`;

      console.log(`Creating event ${event.id} in calendar ${calendar_path}`);

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

      const req = https.request(options, res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          if (
            res.statusCode === 200 ||
            res.statusCode === 201 ||
            res.statusCode === 204
          ) {
            console.log(
              `✅ Event ${event.id} created successfully in ${calendar_path}`
            );
            resolve(true);
          } else {
            console.error(
              `❌ Failed to create event ${event.id}: ${res.statusCode}`
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

  /**
   * Delete event from specific calendar using filename
   */
  async deleteEvent(
    eventId: string,
    calendar_path: string,
    filename: string
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(
        `${this.credentials.username}:${this.credentials.password}`
      ).toString('base64');

      const eventUrl = `${this.basePath}${calendar_path}${filename}`;
      console.log(
        `Deleting event ${eventId} from ${calendar_path} using filename: ${filename}`
      );

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
            console.log(
              `✅ Event ${eventId} deleted successfully from ${calendar_path}`
            );
            resolve(true);
          } else {
            console.error(
              `❌ Failed to delete event ${eventId}: ${res.statusCode}`
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
   * Update event in specific calendar
   */
  async updateEvent(
    event: CalendarEvent,
    calendar_path: string
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(
        `${this.credentials.username}:${this.credentials.password}`
      ).toString('base64');

      const iCalData = iCalendarGenerator.generateVCalendar(event);
      const encodedEventId = encodeURIComponent(event.id);
      const eventUrl = `${this.basePath}${calendar_path}${encodedEventId}.ics`;

      console.log(`Updating event ${event.id} in calendar ${calendar_path}`);

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

      const req = https.request(options, res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          if (
            res.statusCode === 200 ||
            res.statusCode === 201 ||
            res.statusCode === 204
          ) {
            console.log(
              `✅ Event ${event.id} updated successfully in ${calendar_path}`
            );
            resolve(true);
          } else {
            console.error(
              `❌ Failed to update event ${event.id}: ${res.statusCode}`
            );
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

  // Helper methods (keeping existing implementations)
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
    return `<C:time-range start="${start}" end="${end}" />`;
  }

  private formatCalDAVDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  /**
   * Create event in specific calendar
   */
  async createEventInCalendar(
    event: any,
    calendarName: string
  ): Promise<boolean> {
    const calendar = this.calendars.find(cal => cal.name === calendarName);
    if (!calendar) {
      console.error(`Calendar ${calendarName} not found`);
      console.error(
        `Available calendars: ${this.calendars.map(c => c.name).join(', ')}`
      );
      return false;
    }

    try {
      console.log(`Creating event ${event.id} in ${calendarName} calendar...`);
      console.log(`Calendar path: ${calendar.path}`);
      console.log(
        `Full URL will be: https://${this.credentials.hostname}${this.basePath}${calendar.path}${event.id}.ics`
      );

      // Generate iCalendar content
      const icalContent = this.generateICalendarContent(event);

      // Create event in specific calendar
      const response = await this.putEventToCalendar(
        event.id,
        icalContent,
        calendar.path
      );

      if (response.ok) {
        console.log(`✅ Event ${event.id} created in ${calendarName} calendar`);
        return true;
      } else {
        console.error(
          `❌ Failed to create event in ${calendarName}:`,
          response.status,
          response.statusText
        );
        return false;
      }
    } catch (error) {
      console.error(`❌ Error creating event in ${calendarName}:`, error);
      return false;
    }
  }

  private async putEventToCalendar(
    eventId: string,
    icalContent: string,
    calendarPath: string
  ): Promise<Response> {
    const url = `https://${this.credentials.hostname}${this.basePath}${calendarPath}${eventId}.ics`;

    return fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.credentials.username}:${this.credentials.password}`).toString('base64')}`,
        'Content-Type': 'text/calendar; charset=utf-8',
        'If-None-Match': '*',
      },
      body: icalContent,
    });
  }

  private generateICalendarContent(event: any): string {
    const now =
      new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const startDate =
      new Date(event.date + (event.time ? `T${event.time}:00` : ''))
        .toISOString()
        .replace(/[-:]/g, '')
        .split('.')[0] + 'Z';
    const endDate = event.dtend
      ? new Date(event.dtend).toISOString().replace(/[-:]/g, '').split('.')[0] +
        'Z'
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
