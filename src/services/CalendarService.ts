// Import the full CalendarEvent interface from DayCell
import { CalendarEvent } from '../types/shared';

/**
 * CalendarService - Handles communication with the backend server
 * that connects to Apple Calendar via CalDAV protocol
 */
class CalendarService {
  /**
   * Fetches events from the backend server
   * Server handles CalDAV communication with Apple Calendar
   * @param calendar Optional calendar filter (home, work, shared, meals)
   * @returns Promise<CalendarEvent[]> Array of calendar events
   */
  async fetchEvents(calendar?: string): Promise<CalendarEvent[]> {
    try {
      // Make HTTP request to our TypeScript server endpoint
      const url = calendar
        ? `http://localhost:3001/events?calendar=${encodeURIComponent(calendar)}`
        : 'http://localhost:3001/events';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.status}`);
      }
      // Parse JSON response containing calendar events
      const rawEvents = await response.json();

      // Transform server response to match Calendar component interface
      const events: CalendarEvent[] = rawEvents.map(
        (event: Record<string, unknown>) => ({
          id: event.id as string,
          title: event.title as string,
          date: event.date as string, // Already in YYYY-MM-DD format from API
          time: this.formatTimeTo24h(event.time as string),
          // Preserve all rich CalDAV data
          description: event.description as string,
          location: event.location as string,
          organizer: event.organizer as string,
          attendees: event.attendees as string[],
          categories: event.categories as string[],
          priority: event.priority as number,
          status: event.status as string,
          visibility: event.visibility as string,
          dtend: event.dtend as string,
          duration: event.duration as string,
          rrule: event.rrule as string,
          created: event.created as string,
          lastModified: event.lastModified as string,
          sequence: event.sequence as number,
          url:
            typeof event.url === 'object'
              ? ((event.url as Record<string, unknown>)?.val as string)
              : (event.url as string),
          geo: event.geo as Record<string, unknown>,
          transparency: event.transparency as string,
          attachments: event.attachments as string[],
          timezone: event.timezone as string,
          // Calendar metadata
          calendar_name: event.calendar_name as string,
          calendar_path: event.calendar_path as string,
          caldav_filename: event.caldav_filename as string,
        })
      );

      return events;
    } catch (error) {
      // Error handled - fallback to mock events
      // Fallback to mock events if server is unavailable
      return this.getMockEvents();
    }
  }

  /**
   * Returns demo events when Apple Calendar is unavailable
   * Used as fallback when server connection fails
   * @returns CalendarEvent[] Array of mock calendar events
   */
  private getMockEvents(): CalendarEvent[] {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    return [
      {
        id: '1',
        title: 'Meeting (Demo)',
        date: this.formatDateToYMD(today.toISOString()),
        time: '10:00',
      },
      {
        id: '2',
        title: 'Lunch (Demo)',
        date: this.formatDateToYMD(tomorrow.toISOString()),
        time: '12:30',
      },
    ];
  }

  /**
   * Converts ISO date string to YYYY-MM-DD format
   * @param isoDate ISO date string from server
   * @returns YYYY-MM-DD formatted date string
   */
  private formatDateToYMD(isoDate: string): string {
    const date = new Date(isoDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Safe date parsing to avoid timezone issues
   * @param date Date string in YYYY-MM-DD format
   * @returns Date object in local timezone
   */
  static parseLocal(date: string): Date {
    const [y, m, d] = date.split('-').map(Number);
    if (!y || !m || !d) return new Date(NaN);
    return new Date(y, m - 1, d);
  }

  /**
   * Converts 24-hour time format to 12-hour format for display
   * @param time24h Time string in 24-hour format (e.g., "14:30", "09:00")
   * @returns 12-hour formatted time string (e.g., "2:30 PM", "9:00 AM") or undefined
   */
  static formatTimeTo12h(time24h?: string): string | undefined {
    if (!time24h) return undefined;

    try {
      const parts = time24h.split(':');
      const hours = Number(parts[0]);
      const minutes = Number(parts[1]);

      const period = hours >= 12 ? 'PM' : 'AM';
      let displayHours = hours;

      if (hours === 0)
        displayHours = 12; // 00:xx -> 12:xx AM
      else if (hours > 12) displayHours = hours - 12; // 13:xx -> 1:xx PM

      return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
    } catch {
      return undefined;
    }
  }

  /**
   * Converts 12-hour time format to 24-hour HH:mm format
   * @param time12h Time string from server (e.g., "10:00 AM", "2:30 PM")
   * @returns 24-hour formatted time string (e.g., "10:00", "14:30") or undefined
   */
  private formatTimeTo24h(timeStr?: string): string | undefined {
    if (!timeStr || timeStr === 'All Day' || timeStr === 'all day') return undefined;

    try {
      // Check if already in 24-hour format (HH:MM)
      const time24Match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
      if (time24Match) {
        const hours = parseInt(time24Match[1] || '0', 10);
        const minutes = time24Match[2] || '00';
        // Validate the time values
        if (hours >= 0 && hours <= 23) {
          return `${String(hours).padStart(2, '0')}:${minutes}`;
        }
      }

      // Handle 12-hour format like "10:00 AM" or "2:30 PM"
      const time12Match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (time12Match) {
        let hours = parseInt(time12Match[1] || '0', 10);
        const minutes = time12Match[2] || '00';
        const period = time12Match[3]?.toUpperCase() || 'AM';

        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;

        return `${String(hours).padStart(2, '0')}:${minutes}`;
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Creates a new calendar event
   * @param event Event data with optional calendar_name
   * @returns Promise<boolean> Success status
   */
  async createEvent(
    event: Partial<CalendarEvent> & { calendar_name?: string }
  ): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:3001/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        throw new Error(`Failed to create event: ${response.status}`);
      }

      const result = await response.json();
      return result.success === true;
    } catch (error) {
      // Event creation failed
      return false;
    }
  }

  /**
   * Updates an existing calendar event
   * @param event Updated event data
   * @returns Promise<boolean> Success status
   */
  async updateEvent(event: CalendarEvent): Promise<boolean> {
    try {
      // Use Base64 encoding for event IDs with special characters to avoid Express routing issues
      const encodedEventId = btoa(event.id).replace(/[+/=]/g, match => {
        return { '+': '-', '/': '_', '=': '' }[match] || match;
      });
      const response = await fetch(
        `http://localhost:3001/events/${encodedEventId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update event: ${response.status}`);
      }

      const result = await response.json();
      return result.success === true;
    } catch (error) {
      // Event update failed
      return false;
    }
  }

  /**
   * Deletes a calendar event
   * @param eventId Event ID to delete
   * @returns Promise<boolean> Success status
   */
  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      // Use Base64 encoding for event IDs with special characters
      const encodedEventId = btoa(eventId).replace(/[+/=]/g, match => {
        return { '+': '-', '/': '_', '=': '' }[match] || match;
      });

      const response = await fetch(
        `http://localhost:3001/events/${encodedEventId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete event: ${response.status}`);
      }

      const result = await response.json();
      return result.success === true;
    } catch (error) {
      // Event deletion failed
      return false;
    }
  }

  /**
   * Triggers a manual sync with Apple Calendar
   * @returns Promise<boolean> Success status
   */
  async syncCalendar(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:3001/admin/sync', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to sync: ${response.status}`);
      }

      const result = await response.json();
      return result.success === true;
    } catch (error) {
      // Sync failed
      return false;
    }
  }

  /**
   * Fetches available calendars with event counts
   * @returns Promise<Array<{name: string, count: number}>> Array of calendars
   */
  async fetchCalendars(): Promise<Array<{ name: string; count: number }>> {
    try {
      const response = await fetch('http://localhost:3001/calendars');
      if (!response.ok) {
        throw new Error(`Failed to fetch calendars: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      // Calendar fetch failed - using fallback
      return [
        { name: 'home', count: 0 },
        { name: 'work', count: 0 },
        { name: 'shared', count: 0 },
        { name: 'meals', count: 0 },
      ];
    }
  }

  /**
   * Logs connection attempt to Apple Calendar
   * Actual connection is handled by the backend server
   * @returns Promise<boolean> Always returns true
   */
  async connectToAppleCalendar(): Promise<boolean> {
    return true;
  }

  /**
   * VACATION TRACKING METHODS (modular)
   * Frontend interface to vacation API endpoints
   */

  /**
   * Fetches vacation balances for all users
   * @returns Promise<Array<{user_name: string, balance_hours: number, last_updated: string}>>
   */
  async fetchVacationBalances(): Promise<
    Array<{ user_name: string; balance_hours: number; last_updated: string }>
  > {
    try {
      const response = await fetch('http://localhost:3001/vacation-balances');
      if (!response.ok) {
        throw new Error(
          `Failed to fetch vacation balances: ${response.status}`
        );
      }
      return await response.json();
    } catch (error) {
      // Vacation balance fetch failed
      return [];
    }
  }
}

export default CalendarService;
