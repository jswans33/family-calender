import { Request, Response } from 'express';
import { ICalendarService } from '../types/Calendar.js';
import { VacationService } from '../services/VacationService.js';
import { ValidationService } from '../services/ValidationService.js';

export class CalendarController {
  private calendarService: ICalendarService;
  private vacationService: VacationService | null;

  constructor(
    calendarService: ICalendarService,
    vacationService?: VacationService
  ) {
    this.calendarService = calendarService;
    this.vacationService = vacationService || null;
  }

  async getEvents(req: Request, res: Response): Promise<void> {
    try {
      const { calendar } = req.query;
      const calendarFilter = ValidationService.validateCalendarFilter(calendar);

      const events =
        await this.calendarService.getEventsWithMetadata(calendarFilter);
      res.json(events);
    } catch (error) {
      console.error('Error in CalendarController.getEvents:', error);
      res.status(500).json({
        error: 'Failed to fetch calendar events',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getTodaysEvents(req: Request, res: Response): Promise<void> {
    try {
      const events = await this.calendarService.getTodaysEvents();
      res.json(events);
    } catch (error) {
      console.error('Error in CalendarController.getTodaysEvents:', error);
      res.status(500).json({
        error: "Failed to fetch today's events",
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getThisWeeksEvents(req: Request, res: Response): Promise<void> {
    try {
      const events = await this.calendarService.getThisWeeksEvents();
      res.json(events);
    } catch (error) {
      console.error('Error in CalendarController.getThisWeeksEvents:', error);
      res.status(500).json({
        error: "Failed to fetch this week's events",
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getThisMonthsEvents(req: Request, res: Response): Promise<void> {
    try {
      const events = await this.calendarService.getThisMonthsEvents();
      res.json(events);
    } catch (error) {
      console.error('Error in CalendarController.getThisMonthsEvents:', error);
      res.status(500).json({
        error: "Failed to fetch this month's events",
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateEvent(req: Request, res: Response): Promise<void> {
    try {
      const encodedId = req.params.id;
      if (!encodedId) {
        res.status(400).json({ error: 'Event ID is required' });
        return;
      }
      const eventId = ValidationService.decodeEventId(encodedId);
      const eventData = req.body;

      // CODE_SMELL: Rule #1 One Thing Per File - Validation logic in controller
      // Fix: Move to ValidationService.validateEventUpdate(eventData, eventId)
      // Ensure the event ID matches the URL parameter
      if (eventData.id && eventData.id !== eventId) {
        res.status(400).json({
          error: 'Event ID mismatch',
          message: 'Event ID in body must match URL parameter',
        });
        return;
      }

      // Set the event ID from URL if not in body
      if (!eventData.id) {
        eventData.id = eventId;
      }

      if (!this.calendarService.updateEvent) {
        res
          .status(501)
          .json({ error: 'Update event not supported by calendar service' });
        return;
      }
      const success = await this.calendarService.updateEvent(eventData);

      if (success) {
        res.json({ success: true, message: 'Event updated successfully' });
      } else {
        res.status(500).json({
          error: 'Failed to update event',
          message: 'CalDAV update operation failed',
        });
      }
    } catch (error) {
      console.error('Error in CalendarController.updateEvent:', error);
      res.status(500).json({
        error: 'Failed to update calendar event',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteEvent(req: Request, res: Response): Promise<void> {
    try {
      const encodedId = req.params.id;
      if (!encodedId) {
        res.status(400).json({
          error: 'Missing event ID',
          message: 'Event ID parameter is required',
        });
        return;
      }

      const eventId = ValidationService.decodeEventId(encodedId);

      // Type check for DatabaseCalendarService
      if (typeof this.calendarService.deleteEvent !== 'function') {
        res.status(501).json({
          error: 'Event deletion not supported',
          message: 'This service does not support event deletion',
        });
        return;
      }

      // Get event before deletion for vacation processing
      let eventToDelete: any = null;
      if (this.vacationService) {
        const events = await this.calendarService.getEventsWithMetadata();
        eventToDelete = events.find(e => e.id === eventId) || null;
      }

      const success = await this.calendarService.deleteEvent(eventId);

      if (success) {
        // Process vacation restoration if applicable
        if (this.vacationService && eventToDelete?.isVacation) {
          try {
            await this.vacationService.processVacationEventDeletion(
              eventToDelete
            );
          } catch (vacationError) {
            console.error(
              'Vacation restoration failed (event still deleted):',
              vacationError
            );
          }
        }
        res.json({ success: true, message: 'Event deleted successfully' });
      } else {
        res.status(404).json({
          error: 'Event not found',
          message: 'The specified event could not be found',
        });
      }
    } catch (error) {
      console.error('Error in CalendarController.deleteEvent:', error);
      res.status(500).json({
        error: 'Failed to delete event',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createEvent(req: Request, res: Response): Promise<void> {
    try {
      console.log(
        '📨 CREATE EVENT REQUEST - Raw body:',
        JSON.stringify(req.body, null, 2)
      );
      const eventData = req.body;
      ValidationService.validateEventData(eventData);
      const calendarName = eventData.calendar_name || 'shared'; // Default to shared calendar
      console.log(
        '📅 CREATE EVENT - After validation, calendar:',
        calendarName
      );

      // Generate ID if not provided
      if (!eventData.id) {
        eventData.id = `local-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      }

      // Preserve original values if not already set
      if (!eventData.original_date) {
        eventData.original_date = eventData.date;
        eventData.original_time = eventData.time || '';
        eventData.original_duration = eventData.duration || 'PT1H0M';
        eventData.creation_source = eventData.creation_source || 'user';
      }

      // Convert date/time format to start/end if needed
      if (!eventData.start && eventData.date) {
        // Create start datetime from date and optional time
        if (eventData.time) {
          eventData.start = new Date(
            `${eventData.date}T${eventData.time}:00`
          ).toISOString();
        } else {
          eventData.start = new Date(
            `${eventData.date}T00:00:00`
          ).toISOString();
        }

        // Create end datetime - use dtend if provided, otherwise 1 hour after start
        if (eventData.dtend) {
          eventData.end = eventData.dtend;
        } else if (eventData.duration) {
          // Parse duration if provided (e.g., "PT60M" = 60 minutes)
          const durationMatch = eventData.duration.match(/PT(\d+)M/);
          const minutes = durationMatch ? parseInt(durationMatch[1]) : 60;
          const endDate = new Date(eventData.start);
          endDate.setMinutes(endDate.getMinutes() + minutes);
          eventData.end = endDate.toISOString();
        } else {
          // Default to 1 hour duration
          const endDate = new Date(eventData.start);
          endDate.setHours(endDate.getHours() + 1);
          eventData.end = endDate.toISOString();
        }
      }

      // Type check for DatabaseCalendarService
      if (typeof this.calendarService.createEventInCalendar !== 'function') {
        res.status(501).json({
          error: 'Multi-calendar event creation not supported',
          message:
            'This service does not support creating events in specific calendars',
        });
        return;
      }

      console.log('🗃️ EVENT DATA BEFORE CALDAV CREATE:', {
        title: eventData.title,
        date: eventData.date,
        time: eventData.time,
        duration: eventData.duration,
        original_date: eventData.original_date,
        original_time: eventData.original_time,
        original_duration: eventData.original_duration,
        creation_source: eventData.creation_source,
      });

      const success = await this.calendarService.createEventInCalendar(
        eventData,
        calendarName
      );

      if (success) {
        res.status(201).json({
          success: true,
          message: 'Event created successfully',
          id: eventData.id,
        });
      } else {
        res.status(500).json({
          error: 'Failed to create event',
          message: 'Event creation failed',
        });
      }
    } catch (error) {
      console.error('Error in CalendarController.createEvent:', error);
      res.status(500).json({
        error: 'Failed to create event',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
