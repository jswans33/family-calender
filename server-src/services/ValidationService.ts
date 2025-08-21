import { Buffer } from 'buffer';

export class ValidationService {
  /**
   * Decodes a base64-encoded event ID from URL parameters
   */
  static decodeEventId(encodedId: string): string {
    const base64Id = encodedId.replace(/[-_]/g, match => {
      return { '-': '+', _: '/' }[match] || match;
    });
    const paddedBase64 = base64Id + '='.repeat((4 - (base64Id.length % 4)) % 4);
    return Buffer.from(paddedBase64, 'base64').toString('utf-8');
  }

  /**
   * Validates that an event has required fields
   */
  static validateEventData(eventData: any): void {
    console.log(
      '🔍 VALIDATION DEBUG - Incoming event data:',
      JSON.stringify(eventData, null, 2)
    );

    if (!eventData.title) {
      console.error('❌ VALIDATION FAILED: Event title is required');
      throw new Error('Event title is required');
    }

    // Handle both formats: (start/end) and (date/time)
    const hasStartEnd = eventData.start && eventData.end;
    const hasDateTime = eventData.date;

    console.log('🔍 VALIDATION DEBUG - Format check:', {
      hasStartEnd,
      hasDateTime,
      start: eventData.start,
      end: eventData.end,
      date: eventData.date,
      time: eventData.time,
      duration: eventData.duration,
      // Original values
      original_date: eventData.original_date,
      original_time: eventData.original_time,
      original_duration: eventData.original_duration,
      creation_source: eventData.creation_source,
    });

    if (!hasStartEnd && !hasDateTime) {
      console.error(
        '❌ VALIDATION FAILED: Event must have either start/end times or date'
      );
      throw new Error('Event must have either start/end times or date');
    }

    // If using date/time format, ensure date is provided
    if (!hasStartEnd && !eventData.date) {
      console.error('❌ VALIDATION FAILED: Event date is required');
      throw new Error('Event date is required');
    }

    console.log('✅ VALIDATION PASSED for event:', eventData.title);
  }

  /**
   * Validates calendar filter parameter
   */
  static validateCalendarFilter(calendar: unknown): string | undefined {
    if (calendar === undefined || calendar === null) {
      return undefined;
    }
    if (typeof calendar !== 'string') {
      throw new Error('Calendar filter must be a string');
    }
    return calendar;
  }
}
