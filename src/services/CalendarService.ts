// Type definition for calendar events
interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
}

/**
 * CalendarService - Handles communication with the backend server
 * that connects to Apple Calendar via CalDAV protocol
 */
class CalendarService {
  /**
   * Fetches events from the backend server
   * Server handles CalDAV communication with Apple Calendar
   * @returns Promise<CalendarEvent[]> Array of calendar events
   */
  async fetchEvents(): Promise<CalendarEvent[]> {
    try {
      // Make HTTP request to our TypeScript server endpoint
      const response = await fetch('http://localhost:3001/events');
      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.status}`);
      }
      // Parse JSON response containing calendar events
      const events: CalendarEvent[] = await response.json();
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
    return [
      {
        id: '1',
        title: 'Meeting (Demo)',
        date: new Date().toISOString(),
        time: '10:00 AM'
      },
      {
        id: '2', 
        title: 'Lunch (Demo)',
        date: new Date(Date.now() + 86400000).toISOString(),
        time: '12:30 PM'
      }
    ];
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