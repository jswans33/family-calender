import { iCalendarGenerator } from '../iCalendarGenerator.js';
import { CalendarEvent } from '../../types/Calendar.js';

describe('iCalendarGenerator', () => {
  describe('All-Day Events', () => {
    test('should generate correct DTSTART;VALUE=DATE for all-day event with empty time', () => {
      const event: CalendarEvent = {
        id: 'test-1',
        title: 'All Day Test',
        date: '2025-08-29',
        time: '', // Empty time = all-day
        start: '',
        end: '',
        duration: 'PT24H0M',
        status: 'CONFIRMED'
      };

      const ical = iCalendarGenerator.generateVEvent(event);
      
      // Should use VALUE=DATE format for all-day events
      expect(ical).toContain('DTSTART;VALUE=DATE:20250829');
      expect(ical).toContain('DTEND;VALUE=DATE:20250830'); // Next day for all-day
      expect(ical).toContain('SUMMARY:All Day Test');
      
      // Should NOT contain time components in DTSTART/DTEND for all-day events
      expect(ical).not.toContain('T00');
      expect(ical).not.toContain('T06');
      // DTSTART and DTEND should not have time components for all-day
      expect(ical.match(/DTSTART;VALUE=DATE:\d{8}$/m)).toBeTruthy();
      expect(ical.match(/DTEND;VALUE=DATE:\d{8}$/m)).toBeTruthy();
    });

    test('should generate correct DTSTART;VALUE=DATE for all-day event with PT24H0M duration', () => {
      const event: CalendarEvent = {
        id: 'test-2',
        title: 'Duration All Day Test',
        date: '2025-08-29',
        time: '00:00',
        start: '',
        end: '',
        duration: 'PT24H0M', // 24 hours = all-day
        status: 'CONFIRMED'
      };

      const ical = iCalendarGenerator.generateVEvent(event);
      
      expect(ical).toContain('DTSTART;VALUE=DATE:20250829');
      expect(ical).toContain('DTEND;VALUE=DATE:20250830');
    });

    test('should generate correct DTSTART;VALUE=DATE for multi-day all-day event', () => {
      const event: CalendarEvent = {
        id: 'test-3',
        title: 'Multi Day Test',
        date: '2025-08-29',
        time: '',
        start: '',
        end: '',
        dtend: '2025-08-31', // 3-day event
        duration: 'PT24H0M',
        status: 'CONFIRMED'
      };

      const ical = iCalendarGenerator.generateVEvent(event);
      
      expect(ical).toContain('DTSTART;VALUE=DATE:20250829');
      expect(ical).toContain('DTEND;VALUE=DATE:20250831');
    });
  });

  describe('Timed Events', () => {
    test('should generate correct DTSTART with time for timed event', () => {
      const event: CalendarEvent = {
        id: 'test-4',
        title: 'Timed Test',
        date: '2025-08-29',
        time: '14:30',
        start: '',
        end: '',
        duration: 'PT1H0M',
        status: 'CONFIRMED',
        timezone: 'America/Denver'
      };

      const ical = iCalendarGenerator.generateVEvent(event);
      
      // Should use DATETIME format for timed events
      expect(ical).toContain('DTSTART:');
      expect(ical).not.toContain('VALUE=DATE');
      expect(ical).toContain('T'); // Should have time component
      expect(ical).toContain('Z'); // Should have UTC indicator
      expect(ical).toContain('SUMMARY:Timed Test');
    });
  });

  describe('All-Day Detection', () => {
    test('should detect empty time as all-day', () => {
      const event: CalendarEvent = {
        id: 'test-5',
        title: 'Empty Time',
        date: '2025-08-29',
        time: '',
        start: '',
        end: '',
        status: 'CONFIRMED'
      };

      const isAllDay = iCalendarGenerator.isAllDayEvent(event);
      expect(isAllDay).toBe(true);
    });

    test('should detect PT24H0M duration as all-day', () => {
      const event: CalendarEvent = {
        id: 'test-6',
        title: 'PT24H0M Duration',
        date: '2025-08-29',
        time: '00:00',
        start: '',
        end: '',
        duration: 'PT24H0M',
        status: 'CONFIRMED'
      };

      const isAllDay = iCalendarGenerator.isAllDayEvent(event);
      expect(isAllDay).toBe(true);
    });

    test('should detect "All Day" time as all-day', () => {
      const event: CalendarEvent = {
        id: 'test-7',
        title: 'All Day String',
        date: '2025-08-29',
        time: 'All Day',
        start: '',
        end: '',
        status: 'CONFIRMED'
      };

      const isAllDay = iCalendarGenerator.isAllDayEvent(event);
      expect(isAllDay).toBe(true);
    });

    test('should NOT detect regular time as all-day', () => {
      const event: CalendarEvent = {
        id: 'test-8',
        title: 'Regular Time',
        date: '2025-08-29',
        time: '14:30',
        start: '',
        end: '',
        duration: 'PT1H0M',
        status: 'CONFIRMED'
      };

      const isAllDay = iCalendarGenerator.isAllDayEvent(event);
      expect(isAllDay).toBe(false);
    });
  });

  describe('Date Formatting', () => {
    test('should format date-only correctly for all-day events', () => {
      const formatted = iCalendarGenerator.formatDateTime('2025-08-29', '');
      expect(formatted).toBe('20250829');
      expect(formatted).not.toContain('T');
      expect(formatted).not.toContain('Z');
    });

    test('should format datetime correctly for timed events', () => {
      const formatted = iCalendarGenerator.formatDateTime('2025-08-29', '14:30');
      expect(formatted).toContain('T');
      expect(formatted).toContain('Z');
      expect(formatted).toMatch(/^\d{8}T\d{6}Z$/); // Format: YYYYMMDDTHHMMSSZ
    });
  });
});