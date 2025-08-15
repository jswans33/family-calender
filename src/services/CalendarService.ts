// Type definition for calendar events - matches the Calendar component interface
interface CalendarEvent {
  id: string;
  title: string;
  date: string;   // 'YYYY-MM-DD' format
  time?: string;  // 'HH:mm' 24h format, optional
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
      const rawEvents = await response.json();
      
      // Transform server response to match Calendar component interface
      const events: CalendarEvent[] = rawEvents.map((event: any) => ({
        id: event.id,
        title: event.title,
        date: this.formatDateToYMD(event.date),
        time: this.formatTimeTo24h(event.time)
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
        time: '10:00'
      },
      {
        id: '2', 
        title: 'Lunch (Demo)',
        date: this.formatDateToYMD(tomorrow.toISOString()),
        time: '12:30'
      }
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