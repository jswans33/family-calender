export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  description?: string;
  location?: string;
  organizer?: string;
  attendees?: string[];
  categories?: string[];
  priority?: number;
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
  visibility?: 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL';
  dtend?: string;
  duration?: string;
  rrule?: string;
  created?: string;
  lastModified?: string;
  sequence?: number;
  url?: string;
  geo?: { lat: number; lon: number };
  transparency?: 'OPAQUE' | 'TRANSPARENT';
  attachments?: string[];
  timezone?: string;
}

export interface CalendarConfig {
  type: string;
  url: string;
  username: string;
  password: string;
  calendar_name: string;
}

export interface Config {
  calendar: CalendarConfig;
}

export interface CalDAVCredentials {
  username: string;
  password: string;
  hostname: string;
  path: string;
}

export interface ICalendarService {
  getEvents(startDate?: Date, endDate?: Date, calendar?: string): Promise<CalendarEvent[]>;
  getTodaysEvents(): Promise<CalendarEvent[]>;
  getThisWeeksEvents(): Promise<CalendarEvent[]>;
  getThisMonthsEvents(): Promise<CalendarEvent[]>;
  getEventsInRange(startDate: Date, endDate: Date): Promise<CalendarEvent[]>;
  validateEvent(event: any): event is CalendarEvent;
  forceSync?(): Promise<void>;
  updateEvent?(event: CalendarEvent): Promise<boolean>;
  createEvent?(event: CalendarEvent): Promise<boolean>;
  deleteEvent?(eventId: string): Promise<boolean>;
  getCalendars?(): Promise<Array<{name: string, count: number}>>;
}
