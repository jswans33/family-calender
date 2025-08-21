import { CalendarEvent } from '../types/Calendar.js';

/**
 * iCalendarGenerator - Generates RFC 5545 compliant iCalendar data
 * Used for creating and updating events in CalDAV
 */
export class iCalendarGenerator {
  /**
   * Generates a complete VCALENDAR with VEVENT for CalDAV PUT operations
   */
  static generateVCalendar(event: CalendarEvent): string {
    const lines = [
      ...this.generateHeader(),
      ...this.generateEventFields(event),
      ...this.generateFooter(),
    ];

    return lines.filter(line => line.length > 0).join('\n');
  }

  /**
   * Generates VCALENDAR header section
   */
  private static generateHeader(): string[] {
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Swanson Light Calendar//EN',
      'BEGIN:VEVENT',
    ];
  }

  /**
   * Generates VEVENT fields for the calendar event
   */
  private static generateEventFields(event: CalendarEvent): string[] {
    const now =
      new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const isAllDay = this.isAllDayEvent(event);

    const fields = [
      `UID:${event.id}`,
      `DTSTAMP:${now}`,
      `DTSTART${isAllDay ? ';VALUE=DATE' : ''}:${this.formatDateTime(event.date, event.time, event.timezone)}`,
      `DTEND${isAllDay ? ';VALUE=DATE' : ''}:${this.formatDateTime(
        event.dtend || this.calculateEndTime(event.date, event.time),
        isAllDay
          ? undefined
          : event.time
            ? this.calculateEndTimeString(event.time)
            : undefined,
        event.timezone
      )}`,
      `SUMMARY:${this.escapeText(event.title)}`,
    ];

    this.addOptionalFields(fields, event);
    fields.push(`LAST-MODIFIED:${now}`);

    return fields;
  }

  /**
   * Generates VCALENDAR footer section
   */
  private static generateFooter(): string[] {
    return ['END:VEVENT', 'END:VCALENDAR'];
  }

  /**
   * Determines if event is all-day
   */
  private static isAllDayEvent(event: CalendarEvent): boolean {
    return (
      event.time === 'All Day' ||
      event.time === 'all day' ||
      !event.time ||
      event.time === ''
    );
  }

  /**
   * Adds optional fields to the event fields array
   */
  private static addOptionalFields(
    fields: string[],
    event: CalendarEvent
  ): void {
    if (event.description)
      fields.push(`DESCRIPTION:${this.escapeText(event.description)}`);
    if (event.location)
      fields.push(`LOCATION:${this.escapeText(event.location)}`);
    if (event.organizer) fields.push(`ORGANIZER:${event.organizer}`);
    if (event.attendees)
      fields.push(...event.attendees.map(a => `ATTENDEE:${a}`));
    if (event.categories)
      fields.push(`CATEGORIES:${event.categories.join(',')}`);
    if (event.status) fields.push(`STATUS:${event.status}`);
    if (event.priority) fields.push(`PRIORITY:${event.priority}`);
    if (event.url) fields.push(`URL:${event.url}`);
    if (event.transparency) fields.push(`TRANSP:${event.transparency}`);
    if (event.sequence) fields.push(`SEQUENCE:${event.sequence}`);
    else fields.push('SEQUENCE:0');
    if (event.created)
      fields.push(`CREATED:${this.formatDateTime(event.created)}`);
  }

  /**
   * Formats date/time for iCalendar DTSTART/DTEND fields
   * Apple CalDAV requires UTC format with Z suffix and seconds included
   */
  private static formatDateTime(
    dateString: string,
    time?: string,
    _timezone?: string
  ): string {
    const date = new Date(dateString);

    if (!time || time === 'All Day' || time === 'all day') {
      // All-day event - use DATE format (YYYYMMDD)
      const datePart = date.toISOString().split('T')[0];
      if (!datePart) {
        throw new Error('Invalid date format');
      }
      return datePart.replace(/-/g, '');
    }

    // For Apple CalDAV, always use UTC format with Z suffix and include seconds
    // Format: YYYYMMDDTHHMMSSZ (e.g., 20231215T140000Z)
    const dateTime = this.combineDateAndTime(date, time);
    const utcDateTime = new Date(dateTime);

    // Format to YYYYMMDDTHHMMSSZ - Apple requires this exact format
    return utcDateTime
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  }

  /**
   * Combines date string with time string
   */
  private static combineDateAndTime(date: Date, time: string): string {
    const dateStr = date.toISOString().split('T')[0];

    // Handle "All Day" events by defaulting to midnight
    if (time === 'All Day' || time === 'all day') {
      return `${dateStr}T00:00:00`;
    }

    // Handle time formats like "14:00" or "2:30 PM"
    if (time.includes(':')) {
      return `${dateStr}T${time}:00`;
    }

    // Default fallback
    return `${dateStr}T${time}:00`;
  }

  /**
   * Calculate end time - default to 1 hour after start
   */
  private static calculateEndTime(date: string, time?: string): string {
    const startDate = new Date(date);
    if (!time) {
      // For all-day events, end is next day
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      return endDate.toISOString();
    }
    // For timed events, default to 1 hour duration
    return date; // Same date, different time
  }

  /**
   * Calculate end time string - add 1 hour to start time
   */
  private static calculateEndTimeString(startTime: string): string {
    // Parse time string (HH:MM format)
    const timeParts = startTime.split(':').map(Number);
    const hours = timeParts[0];
    const minutes = timeParts[1];
    if (hours === undefined || minutes === undefined) {
      throw new Error('Invalid time format');
    }
    const endHours = (hours + 1) % 24;
    return `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  /**
   * Escapes special characters for iCalendar text fields
   */
  private static escapeText(text: string): string {
    return text
      .replace(/\\/g, '\\\\') // Escape backslashes
      .replace(/;/g, '\\;') // Escape semicolons
      .replace(/,/g, '\\,') // Escape commas
      .replace(/\n/g, '\\n') // Escape newlines
      .replace(/\r/g, ''); // Remove carriage returns
  }
}
