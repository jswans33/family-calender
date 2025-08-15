import { Request, Response } from 'express';
import { CalendarService } from '../services/CalendarService.js';

export class CalendarController {
  private calendarService: CalendarService;

  constructor(calendarService: CalendarService) {
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
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getTodaysEvents(req: Request, res: Response): Promise<void> {
    try {
      console.log('Fetching today\'s events...');
      const events = await this.calendarService.getTodaysEvents();
      console.log(`Found ${events.length} events today`);
      res.json(events);
    } catch (error) {
      console.error('Error in CalendarController.getTodaysEvents:', error);
      res.status(500).json({ 
        error: 'Failed to fetch today\'s events',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getThisWeeksEvents(req: Request, res: Response): Promise<void> {
    try {
      console.log('Fetching this week\'s events...');
      const events = await this.calendarService.getThisWeeksEvents();
      console.log(`Found ${events.length} events this week`);
      res.json(events);
    } catch (error) {
      console.error('Error in CalendarController.getThisWeeksEvents:', error);
      res.status(500).json({ 
        error: 'Failed to fetch this week\'s events',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getThisMonthsEvents(req: Request, res: Response): Promise<void> {
    try {
      console.log('Fetching this month\'s events...');
      const events = await this.calendarService.getThisMonthsEvents();
      console.log(`Found ${events.length} events this month`);
      res.json(events);
    } catch (error) {
      console.error('Error in CalendarController.getThisMonthsEvents:', error);
      res.status(500).json({ 
        error: 'Failed to fetch this month\'s events',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}