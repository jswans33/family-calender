import { Buffer } from 'buffer';

export class ValidationService {
  /**
   * Decodes a base64-encoded event ID from URL parameters
   */
  static decodeEventId(encodedId: string): string {
    const base64Id = encodedId.replace(/[-_]/g, match => {
      return { '-': '+', _: '/' }[match] || match;
    });
    const paddedBase64 =
      base64Id + '='.repeat((4 - (base64Id.length % 4)) % 4);
    return Buffer.from(paddedBase64, 'base64').toString('utf-8');
  }

  /**
   * Validates that an event has required fields
   */
  static validateEventData(eventData: any): void {
    if (!eventData.title) {
      throw new Error('Event title is required');
    }
    if (!eventData.start) {
      throw new Error('Event start time is required');
    }
    if (!eventData.end) {
      throw new Error('Event end time is required');
    }
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