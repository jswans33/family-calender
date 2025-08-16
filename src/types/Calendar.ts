export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // 'YYYY-MM-DD' format
  time?: string; // 'HH:mm' 24h format, optional
}

export interface CalendarConfig {
  type: string;
  url: string;
  username: string;
  password: string;
  calendar_name: string;
}
