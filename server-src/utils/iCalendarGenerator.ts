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
    const now =
      new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const isAllDay = event.time === 'All Day' || event.time === 'all day';

    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Swanson Light Calendar//EN
BEGIN:VEVENT
UID:${event.id}
DTSTAMP:${now}
DTSTART${isAllDay ? ';VALUE=DATE' : ''}:${this.formatDateTime(event.date, event.time, event.timezone)}
DTEND${isAllDay ? ';VALUE=DATE' : ''}:${this.formatDateTime(event.dtend || this.calculateEndTime(event.date, event.time), isAllDay ? undefined : this.calculateEndTimeString(event.time), event.timezone)}
SUMMARY:${this.escapeText(event.title)}
${event.description ? `DESCRIPTION:${this.escapeText(event.description)}` : ''}
${event.location ? `LOCATION:${this.escapeText(event.location)}` : ''}
${event.organizer ? `ORGANIZER:${event.organizer}` : ''}
${event.attendees ? event.attendees.map(a => `ATTENDEE:${a}`).join('\n') : ''}
${event.categories ? `CATEGORIES:${event.categories.join(',')}` : ''}
${event.status ? `STATUS:${event.status}` : ''}
${event.priority ? `PRIORITY:${event.priority}` : ''}
${event.url ? `URL:${event.url}` : ''}
${event.transparency ? `TRANSP:${event.transparency}` : ''}
${event.sequence ? `SEQUENCE:${event.sequence}` : 'SEQUENCE:0'}
${event.created ? `CREATED:${this.formatDateTime(event.created)}` : ''}
${event.lastModified ? `LAST-MODIFIED:${now}` : `LAST-MODIFIED:${now}`}
END:VEVENT
END:VCALENDAR`
      .replace(/\n\n+/g, '\n')
      .replace(/^\n+|\n+$/g, '');
  }

  /**
   * Formats date/time for iCalendar DTSTART/DTEND fields
   * Apple CalDAV requires UTC format with Z suffix and seconds included
   */
  private static formatDateTime(
    dateString: string,
    time?: string,
    timezone?: string
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
    return utcDateTime.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
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
