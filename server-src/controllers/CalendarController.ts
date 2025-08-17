import { Buffer } from 'buffer';
import { Request, Response } from 'express';
import { ICalendarService } from '../types/Calendar.js';

export class CalendarController {
  private calendarService: ICalendarService;

  constructor(calendarService: ICalendarService) {
    this.calendarService = calendarService;
  }

  async getEvents(req: Request, res: Response): Promise<void> {
    try {
      const { calendar } = req.query;
      const calendarFilter = calendar as string | undefined;

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
      // CODE_SMELL: Rule #1 One Thing Per File - Business logic in controller
      // Fix: Create URLEncodingService.decodeEventId() for reuse across endpoints
      // Decode Base64-encoded event ID to handle special characters safely
      const encodedId = req.params.id;
      if (!encodedId) {
        res.status(400).json({ error: 'Event ID is required' });
        return;
      }
      // Convert URL-safe Base64 back to standard Base64
      const base64Id = encodedId.replace(/[-_]/g, match => {
        return { '-': '+', _: '/' }[match] || match;
      });
      // Add padding if needed
      const paddedBase64 =
        base64Id + '='.repeat((4 - (base64Id.length % 4)) % 4);
      const eventId = Buffer.from(paddedBase64, 'base64').toString('utf-8');
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
      // CODE_SMELL: Rule #5 No Clever Code - Duplicate Base64 decoding logic
      // Fix: Extract to URLEncodingService.decodeEventId(req.params.id)
      // Decode Base64-encoded event ID
      const encodedId = req.params.id;
      if (!encodedId) {
        res.status(400).json({
          error: 'Missing event ID',
          message: 'Event ID parameter is required',
        });
        return;
      }

      const base64Id = encodedId.replace(/[-_]/g, match => {
        return { '-': '+', _: '/' }[match] || match;
      });
      const paddedBase64 =
        base64Id + '='.repeat((4 - (base64Id.length % 4)) % 4);
      const eventId = Buffer.from(paddedBase64, 'base64').toString('utf-8');

      // Type check for DatabaseCalendarService
      if (typeof this.calendarService.deleteEvent !== 'function') {
        res.status(501).json({
          error: 'Event deletion not supported',
          message: 'This service does not support event deletion',
        });
        return;
      }

      const success = await this.calendarService.deleteEvent(eventId);

      if (success) {
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
      const eventData = req.body;
      const calendarName = eventData.calendar_name || 'shared'; // Default to shared calendar

      // Generate ID if not provided
      if (!eventData.id) {
        eventData.id = `local-${Date.now()}-${Math.random().toString(36).substring(7)}`;
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
