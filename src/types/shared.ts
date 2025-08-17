export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // 'YYYY-MM-DD'
  time?: string; // 'HH:mm' 24h format

  // Rich CalDAV data
  description?: string;
  location?: string;
  organizer?: string;
  attendees?: string[];
  categories?: string[];
  priority?: number;
  status?: string;
  visibility?: string;
  dtend?: string; // End date/time
  duration?: string; // Duration format like "PT1H0M"
  rrule?: string; // Recurrence rule
  created?: string;
  lastModified?: string;
  sequence?: number;
  url?: string; // Meeting/Zoom links
  geo?: {
    lat: number;
    lon: number;
  };
  transparency?: string;
  attachments?: string[];
  timezone?: string;
  // Calendar metadata for multi-calendar support
  calendar_name?: string;
  calendar_path?: string;
  caldav_filename?: string;

  // Vacation tracking
  isVacation?: boolean;
}

export type CalendarView = 'month' | 'week' | 'day';

export interface CalendarOption {
  name: string;
  count: number;
  displayName?: string;
}

export type CalendarName = 'home' | 'work' | 'shared' | 'meals';

export interface CalendarColors {
  [calendarName: string]: string;
}
