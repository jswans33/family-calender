import { CalendarEvent, ICalendarService } from '../types/Calendar.js';
import { CalDAVRepository } from '../repositories/CalDAVRepository.js';

export class CalendarService implements ICalendarService {
  private calDAVRepository: CalDAVRepository;

  constructor(calDAVRepository: CalDAVRepository) {
    this.calDAVRepository = calDAVRepository;
  }

  async getEvents(startDate?: Date, endDate?: Date): Promise<CalendarEvent[]> {
    try {
      const xmlData = await this.calDAVRepository.fetchCalendarData(
        startDate,
        endDate
      );
      const events = this.calDAVRepository.parseCalendarEvents(xmlData);

      if (events.length > 0) {
        return events;
      }

      return this.getFallbackEvents();
    } catch (error) {
      console.error('Error in CalendarService.getEvents:', error);
      return this.getFallbackEvents();
    }
  }

  async getTodaysEvents(): Promise<CalendarEvent[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    return this.getEvents(today, tomorrow);
  }

  async getThisWeeksEvents(): Promise<CalendarEvent[]> {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    return this.getEvents(startOfWeek, endOfWeek);
  }

  async getThisMonthsEvents(): Promise<CalendarEvent[]> {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    return this.getEvents(startOfMonth, endOfMonth);
  }

  async getEventsInRange(
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]> {
    return this.getEvents(startDate, endDate);
  }

  private getFallbackEvents(): CalendarEvent[] {
    return [
      {
        id: '1',
        title: 'No Calendar Access - Demo Event',
        date: new Date().toISOString(),
        time: '10:00 AM',
      },
    ];
  }

  /**
   * Updates an existing calendar event using delete-then-create approach
   * 
   * WHY DELETE-THEN-CREATE APPROACH:
   * Apple CalDAV has complex requirements for PUT operations on existing events:
   * - Requires exact URL matching with .ics extension
   * - Often requires ETag headers for conflict detection  
   * - URL structure can be inconsistent between different CalDAV servers
   * - Many CalDAV clients (like Thunderbird, Evolution) use this approach
   * 
   * DELETE-THEN-CREATE BENEFITS:
   * - Simpler than handling complex CalDAV update semantics
   * - Avoids ETag/conflict resolution complexity
   * - Works reliably across different CalDAV server implementations
   * - DELETE is straightforward (just needs event ID)
   * - CREATE uses timestamp-based filenames to avoid conflicts
   * 
   * TRADE-OFFS:
   * - Brief moment where event doesn't exist (not atomic)
   * - Changes the internal CalDAV URL/filename 
   * - May affect sync clients that cache URLs
   * - Requires two HTTP requests instead of one
   * 
   * ROLLBACK STRATEGY:
   * If create fails after successful delete, we log the error but cannot
   * restore the original event. This is an accepted limitation for simplicity.
   * In production, consider implementing a backup/restore mechanism.
   * 
   * @param event Updated event data with existing ID
   * @returns Promise<boolean> Success status of the complete operation
   */
  async updateEvent(event: CalendarEvent): Promise<boolean> {
    try {
      // Validate the event data before any operations
      if (!this.validateEventForUpdate(event)) {
        console.error('Invalid event data for update:', event);
        return false;
      }

      console.log(`Starting delete-then-create update for event ${event.id}`);

      // STEP 1: Delete the existing event
      // This removes the event from the CalDAV server completely
      console.log(`Step 1: Deleting existing event ${event.id}`);
      const deleteSuccess = await this.calDAVRepository.deleteEvent(event.id);
      
      if (!deleteSuccess) {
        console.error(`Failed to delete existing event ${event.id} - aborting update`);
        return false;
      }
      
      console.log(`Step 1 completed: Event ${event.id} deleted successfully`);

      // STEP 2: Create the event with updated data
      // Uses timestamp-based filename to avoid any URL conflicts
      console.log(`Step 2: Creating event ${event.id} with updated data`);
      const createSuccess = await this.calDAVRepository.createEvent(event);
      
      if (!createSuccess) {
        console.error(
          `CRITICAL: Event ${event.id} was deleted but recreation failed! ` +
          `Event data may be lost. Consider manual recovery.`
        );
        return false;
      }

      console.log(
        `Event ${event.id} updated successfully using delete-then-create approach`
      );
      
      return true;
    } catch (error) {
      console.error(
        `Error in CalendarService.updateEvent for event ${event.id}:`, 
        error
      );
      return false;
    }
  }

  validateEvent(event: any): event is CalendarEvent {
    return (
      typeof event === 'object' &&
      typeof event.id === 'string' &&
      typeof event.title === 'string' &&
      typeof event.date === 'string' &&
      typeof event.time === 'string'
    );
  }

  private validateEventForUpdate(event: CalendarEvent): boolean {
    return (
      typeof event.id === 'string' &&
      event.id.length > 0 &&
      typeof event.title === 'string' &&
      event.title.trim().length > 0 &&
      typeof event.date === 'string' &&
      event.date.length > 0
    );
  }
}
