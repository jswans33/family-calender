import { CalendarEvent } from '../types/Calendar.js';
import { CalDAVRepository } from '../repositories/CalDAVRepository.js';

export class CalendarService {
  private calDAVRepository: CalDAVRepository;

  constructor(calDAVRepository: CalDAVRepository) {
    this.calDAVRepository = calDAVRepository;
  }

  async getEvents(startDate?: Date, endDate?: Date): Promise<CalendarEvent[]> {
    try {
      const xmlData = await this.calDAVRepository.fetchCalendarData(startDate, endDate);
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

  async getEventsInRange(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    return this.getEvents(startDate, endDate);
  }

  private getFallbackEvents(): CalendarEvent[] {
    return [
      {
        id: '1',
        title: 'No Calendar Access - Demo Event',
        date: new Date().toISOString(),
        time: '10:00 AM'
      }
    ];
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
}