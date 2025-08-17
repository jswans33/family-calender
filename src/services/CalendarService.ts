// Import the full CalendarEvent interface from DayCell
import { CalendarEvent } from '../components/primitives/DayCell';

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
      const url = calendar ? `http://localhost:3001/events?calendar=${encodeURIComponent(calendar)}` : 'http://localhost:3001/events';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.status}`);
      }
      // Parse JSON response containing calendar events
      const rawEvents = await response.json();

      // Transform server response to match Calendar component interface
      const events: CalendarEvent[] = rawEvents.map((event: any) => ({
        id: event.id,
        title: event.title,
        date: this.formatDateToYMD(event.date),
        time: this.formatTimeTo24h(event.time),
        // Preserve all rich CalDAV data
        description: event.description,
        location: event.location,
        organizer: event.organizer,
        attendees: event.attendees,
        categories: event.categories,
        priority: event.priority,
        status: event.status,
        visibility: event.visibility,
        dtend: event.dtend,
        duration: event.duration,
        rrule: event.rrule,
        created: event.created,
        lastModified: event.lastModified,
        sequence: event.sequence,
        url: typeof event.url === 'object' ? event.url?.val : event.url,
        geo: event.geo,
        transparency: event.transparency,
        attachments: event.attachments,
        timezone: event.timezone,
        // Calendar metadata
        calendar_name: event.calendar_name,
        calendar_path: event.calendar_path,
        caldav_filename: event.caldav_filename,
      }));

      return events;
    } catch (error) {
      console.error('Error fetching calendar events:', error);
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
   * Converts 12-hour time format to 24-hour HH:mm format
   * @param time12h Time string from server (e.g., "10:00 AM", "2:30 PM")
   * @returns 24-hour formatted time string (e.g., "10:00", "14:30") or undefined
   */
  private formatTimeTo24h(time12h?: string): string | undefined {
    if (!time12h || time12h === 'All Day') return undefined;

    try {
      // Handle format like "10:00 AM" or "2:30 PM"
      const match = time12h.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!match) return undefined;

      let hours = parseInt(match[1] || '0', 10);
      const minutes = match[2] || '00';
      const period = match[3]?.toUpperCase() || 'AM';

      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;

      return `${String(hours).padStart(2, '0')}:${minutes}`;
    } catch {
      return undefined;
    }
  }

  /**
   * Creates a new calendar event
   * @param event Event data with optional calendar_name
   * @returns Promise<boolean> Success status
   */
  async createEvent(event: Partial<CalendarEvent> & { calendar_name?: string }): Promise<boolean> {
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
      console.error('Error creating calendar event:', error);
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
      console.error('Error updating calendar event:', error);
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
      console.error('Error deleting calendar event:', error);
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
      console.error('Error syncing calendar:', error);
      return false;
    }
  }

  /**
   * Fetches available calendars with event counts
   * @returns Promise<Array<{name: string, count: number}>> Array of calendars
   */
  async fetchCalendars(): Promise<Array<{name: string, count: number}>> {
    try {
      const response = await fetch('http://localhost:3001/calendars');
      if (!response.ok) {
        throw new Error(`Failed to fetch calendars: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching calendars:', error);
      return [
        { name: 'home', count: 0 },
        { name: 'work', count: 0 },
        { name: 'shared', count: 0 },
        { name: 'meals', count: 0 }
      ];
    }
  }

  /**
   * Logs connection attempt to Apple Calendar
   * Actual connection is handled by the backend server
   * @returns Promise<boolean> Always returns true
   */
  async connectToAppleCalendar(): Promise<boolean> {
    console.log('Connecting to Apple Calendar via TypeScript server...');
    return true;
  }
}

export default CalendarService;
