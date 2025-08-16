import { Request, Response } from 'express';
import { ICalendarService } from '../types/Calendar.js';

export class CalendarController {
  private calendarService: ICalendarService;

  constructor(calendarService: ICalendarService) {
    this.calendarService = calendarService;
  }

  async getEvents(req: Request, res: Response): Promise<void> {
    try {
      console.log('Fetching events from Apple Calendar...');

      const { start, end } = req.query;
      const startDate = start ? new Date(start as string) : undefined;
      const endDate = end ? new Date(end as string) : undefined;

      const events = await this.calendarService.getEvents(startDate, endDate);
      console.log(`Found ${events.length} events`);
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
      console.log("Fetching today's events...");
      const events = await this.calendarService.getTodaysEvents();
      console.log(`Found ${events.length} events today`);
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
      console.log("Fetching this week's events...");
      const events = await this.calendarService.getThisWeeksEvents();
      console.log(`Found ${events.length} events this week`);
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
      console.log("Fetching this month's events...");
      const events = await this.calendarService.getThisMonthsEvents();
      console.log(`Found ${events.length} events this month`);
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

      console.log(`Updating event ${eventId}...`);

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
        console.log(`Event ${eventId} updated successfully`);
        res.json({ success: true, message: 'Event updated successfully' });
      } else {
        console.log(`Failed to update event ${eventId}`);
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

      console.log(`Deleting event ${eventId}...`);

      // Type check for DatabaseCalendarService
      const service = this.calendarService as any;
      if (typeof service.deleteEvent !== 'function') {
        res.status(501).json({
          error: 'Event deletion not supported',
          message: 'This service does not support event deletion',
        });
        return;
      }

      const success = await service.deleteEvent(eventId);

      if (success) {
        console.log(`Event ${eventId} deleted successfully`);
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

      // Generate ID if not provided
      if (!eventData.id) {
        eventData.id = `local-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      }

      console.log(`Creating event ${eventData.id}...`);

      // Type check for DatabaseCalendarService
      const service = this.calendarService as any;
      if (typeof service.createEvent !== 'function') {
        res.status(501).json({
          error: 'Event creation not supported',
          message: 'This service does not support event creation',
        });
        return;
      }

      const success = await service.createEvent(eventData);

      if (success) {
        console.log(`Event ${eventData.id} created successfully`);
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
