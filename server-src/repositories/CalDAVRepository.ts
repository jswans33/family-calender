import https from 'https';
import ical from 'node-ical';
import { CalendarEvent, CalDAVCredentials } from '../types/Calendar.js';

export class CalDAVRepository {
  private credentials: CalDAVCredentials;

  constructor(credentials: CalDAVCredentials) {
    this.credentials = credentials;
  }

  async fetchCalendarData(startDate?: Date, endDate?: Date): Promise<string> {
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(`${this.credentials.username}:${this.credentials.password}`).toString('base64');
      
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
          'Depth': '1',
          'Authorization': `Basic ${auth}`
        }
      };

      const req = https.request(options, (response) => {
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
      const icalMatches = xmlData.match(/<calendar-data[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/calendar-data>/gi);
      
      if (icalMatches) {
        icalMatches.forEach((match) => {
          const icalContent = match.replace(/<calendar-data[^>]*><!\[CDATA\[/, '').replace(/\]\]><\/calendar-data>/, '');
          
          try {
            const parsedCal = ical.parseICS(icalContent);
            
            for (const k in parsedCal) {
              const event = parsedCal[k];
              if (event && event.type === 'VEVENT') {
                const startDate = (event as any).start ? new Date((event as any).start) : new Date();
                const endDate = (event as any).end ? new Date((event as any).end) : null;
                
                const calendarEvent: CalendarEvent = {
                  id: (event as any).uid || k,
                  title: (event as any).summary || 'No Title',
                  date: startDate.toISOString(),
                  time: startDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                };

                if ((event as any).description) calendarEvent.description = (event as any).description;
                if ((event as any).location) calendarEvent.location = (event as any).location;
                
                const organizer = this.parseOrganizer((event as any).organizer);
                if (organizer) calendarEvent.organizer = organizer;
                
                const attendees = this.parseAttendees((event as any).attendee);
                if (attendees) calendarEvent.attendees = attendees;
                
                const categories = this.parseCategories((event as any).categories);
                if (categories) calendarEvent.categories = categories;
                
                if ((event as any).priority) calendarEvent.priority = (event as any).priority;
                
                const status = this.parseStatus((event as any).status);
                if (status) calendarEvent.status = status;
                
                const visibility = this.parseClass((event as any).class);
                if (visibility) calendarEvent.visibility = visibility;
                
                if (endDate) calendarEvent.dtend = endDate.toISOString();
                
                const duration = this.calculateDuration(startDate, endDate);
                if (duration) calendarEvent.duration = duration;
                
                if ((event as any).rrule) calendarEvent.rrule = (event as any).rrule.toString();
                if ((event as any).created) calendarEvent.created = new Date((event as any).created).toISOString();
                if ((event as any).lastmodified) calendarEvent.lastModified = new Date((event as any).lastmodified).toISOString();
                if ((event as any).sequence) calendarEvent.sequence = (event as any).sequence;
                if ((event as any).url) calendarEvent.url = (event as any).url;
                
                const geo = this.parseGeo((event as any).geo);
                if (geo) calendarEvent.geo = geo;
                
                const transparency = this.parseTransparency((event as any).transp);
                if (transparency) calendarEvent.transparency = transparency;
                
                const attachments = this.parseAttachments((event as any).attach);
                if (attachments) calendarEvent.attachments = attachments;
                
                if ((event as any).start && (event as any).start.tz) calendarEvent.timezone = (event as any).start.tz;

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
      return attendee.map(a => typeof a === 'string' ? a : a.val || a.toString()).filter(Boolean);
    }
    const single = typeof attendee === 'string' ? attendee : attendee.val || attendee.toString();
    return single ? [single] : undefined;
  }

  private parseCategories(categories: any): string[] | undefined {
    if (!categories) return undefined;
    if (Array.isArray(categories)) return categories.filter(Boolean);
    if (typeof categories === 'string') return categories.split(',').map(c => c.trim()).filter(Boolean);
    return undefined;
  }

  private parseStatus(status: any): 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED' | undefined {
    if (!status) return undefined;
    const statusStr = (typeof status === 'string' ? status : status.toString()).toUpperCase();
    if (['CONFIRMED', 'TENTATIVE', 'CANCELLED'].includes(statusStr)) {
      return statusStr as 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
    }
    return undefined;
  }

  private parseClass(classField: any): 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL' | undefined {
    if (!classField) return undefined;
    const classStr = (typeof classField === 'string' ? classField : classField.toString()).toUpperCase();
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
    if (geo.lat && geo.lon) return { lat: parseFloat(geo.lat), lon: parseFloat(geo.lon) };
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
    const transpStr = (typeof transp === 'string' ? transp : transp.toString()).toUpperCase();
    if (['OPAQUE', 'TRANSPARENT'].includes(transpStr)) {
      return transpStr as 'OPAQUE' | 'TRANSPARENT';
    }
    return undefined;
  }

  private parseAttachments(attach: any): string[] | undefined {
    if (!attach) return undefined;
    if (Array.isArray(attach)) {
      return attach.map(a => typeof a === 'string' ? a : a.val || a.toString()).filter(Boolean);
    }
    const single = typeof attach === 'string' ? attach : attach.val || attach.toString();
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
}