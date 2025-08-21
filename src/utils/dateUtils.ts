/**
 * Standardized date handling utilities
 * All dates are stored as ISO strings in UTC
 * All comparisons use consistent formats
 */

export class DateUtils {
  // Default timezone for the application
  static DEFAULT_TIMEZONE = 'America/Denver';

  /**
   * Parse any date string/object to a Date object
   */
  static parseDate(dateInput: string | Date | undefined): Date {
    if (!dateInput) return new Date();
    if (dateInput instanceof Date) return dateInput;

    // Handle ISO strings with or without timezone
    if (typeof dateInput === 'string') {
      // If it's just a date (YYYY-MM-DD), treat as start of day in local time
      if (dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return new Date(dateInput + 'T00:00:00');
      }
      return new Date(dateInput);
    }

    return new Date();
  }

  /**
   * Get date string for comparison (YYYY-MM-DD)
   */
  static getDateString(dateInput: string | Date | undefined): string {
    const date = this.parseDate(dateInput);
    return date.toISOString().split('T')[0] || '';
  }

  /**
   * Get time string (HH:MM) from a date
   */
  static getTimeString(dateInput: string | Date | undefined): string {
    const date = this.parseDate(dateInput);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Get local time string for a specific timezone
   */
  static getLocalTimeString(
    dateInput: string | Date | undefined,
    timezone: string = this.DEFAULT_TIMEZONE
  ): string {
    const date = this.parseDate(dateInput);

    try {
      // Use Intl.DateTimeFormat for timezone conversion
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const parts = formatter.formatToParts(date);
      const hour = parts.find(p => p.type === 'hour')?.value || '00';
      const minute = parts.find(p => p.type === 'minute')?.value || '00';
      return `${hour}:${minute}`;
    } catch {
      // Fallback to UTC if timezone is invalid
      return this.getTimeString(date);
    }
  }

  /**
   * Check if a date is today
   */
  static isToday(dateInput: string | Date | undefined): boolean {
    const date = this.getDateString(dateInput);
    const today = this.getDateString(new Date());
    return date === today;
  }

  /**
   * Check if a date is in the future (including today)
   */
  static isFutureOrToday(dateInput: string | Date | undefined): boolean {
    const date = this.getDateString(dateInput);
    const today = this.getDateString(new Date());
    return date >= today;
  }

  /**
   * Format date for display
   */
  static formatDate(dateInput: string | Date | undefined): string {
    const date = this.parseDate(dateInput);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  /**
   * Get debug info for a date/event
   */
  static getDebugInfo(event: Record<string, unknown>): {
    originalDate: string;
    originalTime: string;
    parsedDate: string;
    utcTime: string;
    localTime: string;
    timezone: string;
    isFuture: boolean;
  } {
    const date = this.parseDate(event.date || event.start);
    const timezone = event.timezone || this.DEFAULT_TIMEZONE;

    return {
      originalDate: event.date || event.start || 'NO DATE',
      originalTime: event.time || 'NO TIME',
      parsedDate: this.getDateString(date),
      utcTime: this.getTimeString(date),
      localTime: this.getLocalTimeString(date, timezone),
      timezone: timezone,
      isFuture: this.isFutureOrToday(date),
    };
  }
}
