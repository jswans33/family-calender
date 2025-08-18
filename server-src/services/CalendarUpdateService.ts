import { CalendarEvent } from '../types/Calendar.js';
import { CalDAVMultiCalendarRepository } from '../repositories/CalDAVMultiCalendarRepository.js';
import { SQLiteCompositeRepository } from '../repositories/SQLiteCompositeRepository.js';
import { formatInTimeZone } from 'date-fns-tz';
import { debugLog } from '../config/debug.js';

/**
 * Service responsible for creating, updating, and deleting calendar events
 * Follows Rule #4: Max 3-5 public methods
 */
export class CalendarUpdateService {
  // Hard-coded paths should be moved to config
  private readonly CALENDAR_PATHS: Record<string, string> = {
    personal: '/1110188709/calendars/B87EABEA-126C-4F47-8E1B-31DAE983DC38/',
    work: '/1110188709/calendars/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/',
    shared: '/1110188709/calendars/0C9AAF81-90AD-4D40-8E93-A8D6A925ECDF/',
  };

  constructor(
    private multiCalendarRepository: CalDAVMultiCalendarRepository,
    private sqliteRepository: SQLiteCompositeRepository
  ) {}

  async createEvent(
    event: CalendarEvent,
    calendarName: string = 'shared'
  ): Promise<boolean> {
    debugLog('caldav', `🎯 CalendarUpdateService.createEvent called:`, {
      eventId: event.id,
      title: event.title,
      calendarName,
      hasStart: !!event.start,
      hasEnd: !!event.end
    });
    
    try {
      const calendarPath = this.getCalendarPath(calendarName);
      debugLog('caldav', `📂 Calendar path for ${calendarName}: ${calendarPath}`);
      
      // Create in CalDAV
      const created = await this.multiCalendarRepository.createEventInCalendar(
        event,
        calendarName
      );
      debugLog('caldav', `🔄 CalDAV create result: ${created}`);

      if (created) {
        // Ensure date and time fields are populated from start if not present
        const startDate = event.start ? new Date(event.start) : new Date();
        
        // Determine timezone - default to America/Denver for user events
        const timezone = event.timezone || 'America/Denver';
        
        // Format time in the event's timezone
        let timeString: string;
        try {
          timeString = formatInTimeZone(startDate, timezone, 'HH:mm');
        } catch {
          // Fallback to UTC if timezone conversion fails
          timeString = `${startDate.getUTCHours().toString().padStart(2, '0')}:${startDate.getUTCMinutes().toString().padStart(2, '0')}`;
        }
        
        const eventWithMetadata: any = {
          ...event,
          date: event.date || startDate.toISOString(),
          time: event.time || timeString,
          timezone: timezone,
          calendar_path: calendarPath,
          calendar_name: calendarName,
        };
        debugLog('database', `💾 Saving to database with metadata`);
        await this.sqliteRepository.saveEvents([eventWithMetadata]);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error in CalendarUpdateService.createEvent:', error);
      console.error('Stack:', error instanceof Error ? error.stack : 'No stack');
      return false;
    }
  }

  async updateEvent(event: CalendarEvent): Promise<boolean> {
    try {
      // Get existing event metadata
      const existingEvents = await this.sqliteRepository.getEventsWithMetadata();
      const existingEvent = existingEvents.find(e => e.id === event.id);

      if (!existingEvent?.caldav_filename || !existingEvent?.calendar_path) {
        console.error('Cannot update event without CalDAV metadata');
        return false;
      }

      // Update in CalDAV
      const updated = await this.multiCalendarRepository.updateEventInCalendar(
        event,
        existingEvent.caldav_filename,
        existingEvent.calendar_path
      );

      if (updated) {
        // Update local database by saving the updated event
        const eventWithMetadata: any = {
          ...event,
          caldav_filename: existingEvent.caldav_filename,
          calendar_path: existingEvent.calendar_path,
          calendar_name: existingEvent.calendar_name
        };
        await this.sqliteRepository.saveEvents([eventWithMetadata]);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating event:', error);
      return false;
    }
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      // Get event metadata
      const events = await this.sqliteRepository.getEventsWithMetadata();
      const event = events.find(e => e.id === eventId);

      if (!event) {
        return false;
      }

      // Delete from local database
      const deleted = await this.sqliteRepository.deleteEvent(eventId);

      if (!deleted) {
        return false;
      }

      // Delete from CalDAV if it has metadata
      if (event.caldav_filename && event.calendar_path) {
        try {
          await this.multiCalendarRepository.deleteEventFromCalendar(
            event.caldav_filename,
            event.calendar_path
          );
          // Track that deletion was synced
          await this.sqliteRepository.trackRemoteDeletion(eventId);
        } catch (error) {
          console.error('Failed to delete from CalDAV:', error);
          // Event is still deleted locally
        }
      }

      return true;
    } catch (error) {
      console.error('Error deleting event:', error);
      return false;
    }
  }

  private getCalendarPath(calendarName: string): string {
    const path = this.CALENDAR_PATHS[calendarName];
    return path !== undefined ? path : this.CALENDAR_PATHS.shared || '';
  }
}