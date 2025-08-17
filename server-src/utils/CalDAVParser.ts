import ical from 'node-ical';
import { CalendarEvent } from '../types/Calendar.js';

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

/**
 * Shared utility for parsing CalDAV iCalendar data
 * Follows Rule #4: Each method under 30 lines, focused responsibility
 */
export class CalDAVParser {
  /**
   * Extract iCalendar CDATA content from XML
   */
  static extractICalContent(xmlData: string): string[] {
    const icalMatches = xmlData.match(
      /<calendar-data[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/calendar-data>/gi
    );

    if (!icalMatches) return [];

    return icalMatches.map(match =>
      match
        .replace(/<calendar-data[^>]*><!\[CDATA\[/, '')
        .replace(/\]\]><\/calendar-data>/, '')
    );
  }

  /**
   * Parse iCalendar content into calendar events
   */
  static parseICalContent(icalContent: string): CalendarEvent[] {
    const events: CalendarEvent[] = [];

    try {
      const parsedCal = ical.parseICS(icalContent);

      for (const k in parsedCal) {
        const event = parsedCal[k] as ICalEventData & { type?: string };
        if (event && event.type === 'VEVENT') {
          const calendarEvent = this.buildCalendarEvent(event, k);
          events.push(calendarEvent);
        }
      }
    } catch (parseError) {
      console.error('Error parsing iCal content:', parseError);
    }

    return events;
  }

  /**
   * Build CalendarEvent from parsed iCal data
   */
  static buildCalendarEvent(event: ICalEventData, fallbackId: string): CalendarEvent {
    const startDate = this.parseDate(event.start) || new Date();
    const endDate = this.parseDate(event.end);

    const calendarEvent: CalendarEvent = {
      id: event.uid || fallbackId,
      title: event.summary || 'No Title',
      date: startDate.toISOString(),
      time: startDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      start: startDate.toISOString(),
      end: endDate ? endDate.toISOString() : startDate.toISOString(),
    };

    // Add basic optional fields
    this.addBasicFields(calendarEvent, event, endDate);
    
    // Add metadata fields
    this.addMetadataFields(calendarEvent, event);
    
    // Add timezone if available
    const timezone = this.extractTimezone(event.start);
    if (timezone) {
      calendarEvent.timezone = timezone;
    }

    return calendarEvent;
  }

  /**
   * Add basic optional fields to calendar event
   */
  private static addBasicFields(
    calendarEvent: CalendarEvent,
    event: ICalEventData,
    endDate: Date | null
  ): void {
    if (event.description) calendarEvent.description = event.description;
    if (event.location) calendarEvent.location = event.location;
    if (endDate) {
      calendarEvent.dtend = endDate.toISOString();
      const duration = this.calculateDuration(new Date(calendarEvent.date), endDate);
      if (duration) calendarEvent.duration = duration;
    }
  }

  /**
   * Add metadata fields to calendar event
   */
  private static addMetadataFields(calendarEvent: CalendarEvent, event: ICalEventData): void {
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

    if (event.rrule && event.rrule.toString) calendarEvent.rrule = event.rrule.toString();
    if (event.created) {
      const createdDate = this.parseDate(event.created);
      if (createdDate) calendarEvent.created = createdDate.toISOString();
    }
    if (event.lastmodified) {
      const lastModifiedDate = this.parseDate(event.lastmodified);
      if (lastModifiedDate) calendarEvent.lastModified = lastModifiedDate.toISOString();
    }
    if (event.sequence) calendarEvent.sequence = event.sequence;
    if (event.url) calendarEvent.url = event.url;

    const geo = this.parseGeo(event.geo);
    if (geo) calendarEvent.geo = geo;

    const transparency = this.parseTransparency(event.transp);
    if (transparency) calendarEvent.transparency = transparency;

    const attachments = this.parseAttachments(event.attach);
    if (attachments) calendarEvent.attachments = attachments;
  }

  /**
   * Parse organizer field
   */
  static parseOrganizer(organizer: unknown): string | undefined {
    if (typeof organizer === 'string') return organizer;
    if (
      organizer &&
      typeof organizer === 'object' &&
      organizer !== null &&
      'val' in organizer &&
      typeof (organizer as Record<string, unknown>).val === 'string'
    ) {
      return (organizer as Record<string, unknown>).val as string;
    }
    return undefined;
  }

  /**
   * Parse attendees field
   */
  static parseAttendees(attendee: unknown): string[] | undefined {
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
    
    const single = typeof attendee === 'string'
      ? attendee
      : (attendee as any)?.val || (attendee as any)?.toString() || '';
    return single ? [single] : undefined;
  }

  /**
   * Parse categories field
   */
  static parseCategories(categories: unknown): string[] | undefined {
    if (!categories) return undefined;
    if (Array.isArray(categories)) return categories.filter(Boolean);
    if (typeof categories === 'string') {
      return categories
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);
    }
    return undefined;
  }

  /**
   * Parse status field
   */
  static parseStatus(status: unknown): 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED' | undefined {
    if (!status) return undefined;
    const statusStr = (
      typeof status === 'string' ? status : (status as any)?.toString() || ''
    ).toUpperCase();
    if (['CONFIRMED', 'TENTATIVE', 'CANCELLED'].includes(statusStr)) {
      return statusStr as 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
    }
    return undefined;
  }

  /**
   * Parse class field (visibility)
   */
  static parseClass(classField: unknown): 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL' | undefined {
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

  /**
   * Calculate duration between start and end dates
   */
  static calculateDuration(start: Date, end: Date | null): string | undefined {
    if (!end) return undefined;
    const durationMs = end.getTime() - start.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    return `PT${hours}H${minutes}M`;
  }

  /**
   * Parse geo field
   */
  static parseGeo(geo: unknown): { lat: number; lon: number } | undefined {
    if (!geo) return undefined;
    
    if ((geo as any)?.lat && (geo as any)?.lon) {
      return {
        lat: parseFloat((geo as any)?.lat),
        lon: parseFloat((geo as any)?.lon),
      };
    }
    
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

  /**
   * Parse transparency field
   */
  static parseTransparency(transp: unknown): 'OPAQUE' | 'TRANSPARENT' | undefined {
    if (!transp) return undefined;
    const transpStr = (
      typeof transp === 'string' ? transp : (transp as any)?.toString() || ''
    ).toUpperCase();
    if (['OPAQUE', 'TRANSPARENT'].includes(transpStr)) {
      return transpStr as 'OPAQUE' | 'TRANSPARENT';
    }
    return undefined;
  }

  /**
   * Parse attachments field
   */
  static parseAttachments(attach: unknown): string[] | undefined {
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
    
    const single = typeof attach === 'string'
      ? attach
      : (attach as any)?.val || (attach as any)?.toString() || '';
    return single ? [single] : undefined;
  }

  /**
   * Parse date from various iCal date formats
   */
  static parseDate(dateValue: Date | { toISOString?: () => string; tz?: string } | undefined): Date | null {
    if (!dateValue) return null;
    
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    if (typeof dateValue === 'object' && dateValue.toISOString) {
      try {
        const isoString = dateValue.toISOString();
        return new Date(isoString);
      } catch {
        return null;
      }
    }
    
    try {
      return new Date(dateValue as any);
    } catch {
      return null;
    }
  }

  /**
   * Extract timezone from date value
   */
  static extractTimezone(dateValue: Date | { toISOString?: () => string; tz?: string } | undefined): string | undefined {
    if (!dateValue || dateValue instanceof Date) return undefined;
    
    if (typeof dateValue === 'object' && 'tz' in dateValue) {
      return dateValue.tz;
    }
    
    return undefined;
  }
}