import { RRule, RRuleSet, rrulestr } from 'rrule';
import { CalendarEvent } from '../types/Calendar.js';

export class RecurrenceExpander {
  /**
   * Expands recurring events based on their RRULE
   * @param events Array of calendar events, some with RRULE
   * @param startDate Start of the expansion window (default: today)
   * @param endDate End of the expansion window (default: 3 months from now)
   * @returns Array with recurring events expanded into individual occurrences
   */
  static expandRecurringEvents(
    events: CalendarEvent[],
    startDate: Date = new Date(),
    endDate?: Date
  ): CalendarEvent[] {
    const expandedEvents: CalendarEvent[] = [];
    const defaultEndDate = new Date();
    defaultEndDate.setMonth(defaultEndDate.getMonth() + 3); // 3 months ahead by default
    const expansionEnd = endDate || defaultEndDate;

    console.log(`📅 Expanding recurring events from ${startDate.toISOString()} to ${expansionEnd.toISOString()}`);

    for (const event of events) {
      if (event.rrule) {
        try {
          // Parse the RRULE string
          const rrule = this.parseRRule(event.rrule, event.date);
          
          if (rrule) {
            // Generate occurrences within the date range
            const occurrences = rrule.between(startDate, expansionEnd, true);
            
            console.log(`📅 Event "${event.title}" has ${occurrences.length} occurrences in range`);
            
            // Create an event for each occurrence
            occurrences.forEach((occurrence, index) => {
              const expandedEvent = {
                ...event,
                // Create unique ID for each occurrence
                id: `${event.id}_recur_${occurrence.getTime()}`,
                // Update the date to the occurrence date
                date: occurrence.toISOString(),
                // Mark as recurring occurrence
                isRecurringInstance: true,
                originalEventId: event.id,
                recurrenceDate: occurrence.toISOString(),
              } as CalendarEvent;
              
              expandedEvents.push(expandedEvent);
            });
            
            // Don't include the original event if it's outside the range
            const originalDate = new Date(event.date);
            if (originalDate >= startDate && originalDate <= expansionEnd) {
              expandedEvents.push(event);
            }
          } else {
            // If RRULE parsing fails, include the original event
            expandedEvents.push(event);
          }
        } catch (error) {
          console.error(`Failed to expand recurring event "${event.title}":`, error);
          // Include the original event if expansion fails
          expandedEvents.push(event);
        }
      } else {
        // Non-recurring event - include as-is
        expandedEvents.push(event);
      }
    }

    console.log(`📅 Expanded ${events.length} events to ${expandedEvents.length} total events`);
    return expandedEvents;
  }

  /**
   * Parse RRULE string into RRule object
   */
  private static parseRRule(rruleString: string, eventDate?: string): RRule | null {
    try {
      // Handle different RRULE formats
      if (rruleString.includes('DTSTART')) {
        // Full RRULE with DTSTART
        const parsed = rrulestr(rruleString);
        return parsed instanceof RRule ? parsed : null;
      } else if (rruleString.startsWith('FREQ=')) {
        // Just the RRULE part, need to add DTSTART
        const dtstart = eventDate ? new Date(eventDate) : new Date();
        const fullRRule = `DTSTART:${this.formatDateToRRule(dtstart)}\nRRULE:${rruleString}`;
        const parsed = rrulestr(fullRRule);
        return parsed instanceof RRule ? parsed : null;
      } else if (rruleString.startsWith('RRULE:')) {
        // RRULE with prefix but no DTSTART
        const dtstart = eventDate ? new Date(eventDate) : new Date();
        const fullRRule = `DTSTART:${this.formatDateToRRule(dtstart)}\n${rruleString}`;
        const parsed = rrulestr(fullRRule);
        return parsed instanceof RRule ? parsed : null;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to parse RRULE:', rruleString, error);
      return null;
    }
  }

  /**
   * Format a Date to RRULE date format (YYYYMMDDTHHMMSSZ)
   */
  private static formatDateToRRule(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  /**
   * Check if an event should be visible based on its recurrence
   */
  static isEventVisible(event: CalendarEvent, referenceDate: Date = new Date()): boolean {
    if (!event.rrule) {
      // Non-recurring event - check if it's in the future
      return new Date(event.date) >= referenceDate;
    }

    try {
      const rrule = this.parseRRule(event.rrule, event.date);
      if (rrule) {
        // Check if there's a future occurrence
        const futureDate = new Date();
        futureDate.setMonth(futureDate.getMonth() + 3);
        const futureOccurrences = rrule.between(referenceDate, futureDate, true);
        return futureOccurrences.length > 0;
      }
    } catch (error) {
      console.error('Error checking event visibility:', error);
    }

    return false;
  }
}