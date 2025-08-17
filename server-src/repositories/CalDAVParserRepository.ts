import ical from 'node-ical';
import { CalendarEvent } from '../types/Calendar.js';

interface ICalEventData {
  uid?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: Date | { toISOString?: () => string };
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
  tz?: string;
}

interface ParsedResponse {
  filename: string;
  icalContent: string;
}

export class CalDAVParserRepository {
  parseCalendarEvents(xmlData: string): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    const icalMatches = this.extractICalMatches(xmlData);

    icalMatches.forEach(icalContent => {
      try {
        const parsedCal = ical.parseICS(icalContent);
        const calendarEvents = this.extractEventsFromParsedCal(parsedCal);
        events.push(...calendarEvents);
      } catch (parseError) {
        console.error('Error parsing iCal entry:', parseError);
      }
    });

    return events;
  }

  parseCalendarEventsWithFilenames(
    xmlData: string
  ): { event: CalendarEvent; filename: string }[] {
    const results: { event: CalendarEvent; filename: string }[] = [];
    const responses = this.extractResponseBlocks(xmlData);

    responses.forEach(response => {
      try {
        const filename = this.extractFilenameFromResponse(response);
        const icalContent = this.extractICalFromResponse(response);
        
        if (icalContent) {
          const parsedCal = ical.parseICS(icalContent);
          const events = this.extractEventsFromParsedCal(parsedCal);
          
          events.forEach(event => {
            results.push({
              event,
              filename: filename || `${event.id}.ics`,
            });
          });
        }
      } catch (responseError) {
        console.error('Error parsing response block:', responseError);
      }
    });

    return results;
  }

  parseEventFromIcal(event: ICalEventData, eventKey: string): CalendarEvent {
    const basicFields = this.parseBasicEventFields(event, eventKey);
    const optionalFields = this.parseOptionalEventFields(event);
    const metadataFields = this.parseEventMetadata(event);

    // Ensure required fields are present
    const id = basicFields.id || eventKey;
    const title = basicFields.title || 'No Title';
    const date = basicFields.date || new Date().toISOString();
    const time = basicFields.time || '00:00';
    const start = basicFields.start || date;
    const end = basicFields.end || date;

    return {
      id,
      title,
      date,
      time,
      start,
      end,
      ...optionalFields,
      ...metadataFields,
    } as CalendarEvent;
  }

  private extractResponseBlocks(xmlData: string): string[] {
    const responseMatches = xmlData.match(
      /<response[^>]*>([\s\S]*?)<\/response>/gi
    );
    return responseMatches || [];
  }

  private extractFilenameFromResponse(responseBlock: string): string {
    const hrefMatch = responseBlock.match(/<href[^>]*>(.*?)<\/href>/i);
    
    if (hrefMatch && hrefMatch[1]) {
      const href = hrefMatch[1];
      const filenamePart = href.split('/').pop();
      if (filenamePart && filenamePart.endsWith('.ics')) {
        return filenamePart;
      }
    }
    
    return '';
  }

  private extractICalFromResponse(responseBlock: string): string | null {
    const calendarDataMatch = responseBlock.match(
      /<calendar-data[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/calendar-data>/i
    );
    
    return calendarDataMatch ? calendarDataMatch[1] || null : null;
  }

  private extractICalMatches(xmlData: string): string[] {
    const icalMatches = xmlData.match(
      /<calendar-data[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/calendar-data>/gi
    );

    return (icalMatches || []).map(match =>
      match
        .replace(/<calendar-data[^>]*><!\[CDATA\[/, '')
        .replace(/\]\]><\/calendar-data>/, '')
    );
  }

  private extractEventsFromParsedCal(parsedCal: any): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    
    for (const k in parsedCal) {
      const event = parsedCal[k];
      if (event && event.type === 'VEVENT') {
        const calendarEvent = this.parseEventFromIcal(event, k);
        events.push(calendarEvent);
      }
    }
    
    return events;
  }

  private parseBasicEventFields(event: ICalEventData, eventKey: string): Partial<CalendarEvent> {
    const startDate = event.start instanceof Date ? event.start : 
                     event.start ? new Date(String(event.start)) : new Date();
    const endDate = event.end instanceof Date ? event.end :
                   event.end ? new Date(String(event.end)) : null;

    return {
      id: event.uid || eventKey,
      title: event.summary || 'No Title',
      date: startDate.toISOString(),
      time: startDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      ...(endDate && { dtend: endDate.toISOString() }),
    };
  }

  private parseOptionalEventFields(event: ICalEventData): Partial<CalendarEvent> {
    const fields: Partial<CalendarEvent> = {};
    
    if (event.description) fields.description = event.description;
    if (event.location) fields.location = event.location;
    if (event.priority) fields.priority = event.priority;
    if (event.sequence) fields.sequence = event.sequence;
    if (event.url) fields.url = event.url;
    
    return fields;
  }

  private parseEventMetadata(event: ICalEventData): Partial<CalendarEvent> {
    const metadata: Partial<CalendarEvent> = {};
    
    const organizer = this.parseOrganizer(event.organizer);
    if (organizer) metadata.organizer = organizer;

    const attendees = this.parseAttendees(event.attendee);
    if (attendees) metadata.attendees = attendees;

    const categories = this.parseCategories(event.categories);
    if (categories) metadata.categories = categories;

    const status = this.parseStatus(event.status);
    if (status) metadata.status = status;

    const visibility = this.parseClass(event.class);
    if (visibility) metadata.visibility = visibility;

    if (event.rrule && typeof event.rrule === 'object' && event.rrule !== null && 'toString' in event.rrule && typeof event.rrule.toString === 'function') {
      metadata.rrule = event.rrule.toString();
    }
    if (event.created) {
      const createdDate = event.created instanceof Date ? event.created : new Date(String(event.created));
      metadata.created = createdDate.toISOString();
    }
    if (event.lastmodified) {
      const modifiedDate = event.lastmodified instanceof Date ? event.lastmodified : new Date(String(event.lastmodified));
      metadata.lastModified = modifiedDate.toISOString();
    }

    const geo = this.parseGeo(event.geo);
    if (geo) metadata.geo = geo;

    const transparency = this.parseTransparency(event.transp);
    if (transparency) metadata.transparency = transparency;

    const attachments = this.parseAttachments(event.attach);
    if (attachments) metadata.attachments = attachments;

    if (event.start && typeof event.start === 'object' && 'tz' in event.start) {
      metadata.timezone = (event.start as any).tz;
    }

    const startDate = event.start instanceof Date ? event.start : 
                     event.start ? new Date(String(event.start)) : new Date();
    const endDate = event.end instanceof Date ? event.end :
                   event.end ? new Date(String(event.end)) : null;
    const duration = this.calculateDuration(startDate, endDate);
    if (duration) metadata.duration = duration;

    return metadata;
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
}