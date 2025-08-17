export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // 'YYYY-MM-DD' format
  time?: string; // 'HH:mm' 24h format, optional
  // Rich CalDAV data
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
  // Calendar metadata for multi-calendar support
  calendar_name?: string;
  calendar_path?: string;
  caldav_filename?: string;
}

export interface CalendarConfig {
  type: string;
  url: string;
  username: string;
  password: string;
  calendar_name: string;
}
