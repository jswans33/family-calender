export const API_CONFIG = {
  BASE_URL: 'http://localhost:3001',
  ENDPOINTS: {
    EVENTS: '/events',
    CALENDARS: '/calendars',
  },
} as const;

import { CalendarName } from '../types/shared';

export const CALENDAR_CONFIG = {
  DEFAULT_COLORS: {
    home: '#3B82F6', // blue-500
    work: '#EF4444', // red-500
    shared: '#10B981', // green-500
    meals: '#F59E0B', // yellow-500
  } as Record<CalendarName, string>,
  LABELS: {
    home: 'Home',
    work: 'Work',
    shared: 'Shared',
    meals: 'Meals',
  } as Record<CalendarName, string>,
  FALLBACK_COLOR: '#6B7280', // gray-500
} as const;

export const EVENT_CONFIG = {
  MAX_EVENTS: {
    month: 3,
    week: 8,
    day: 20,
  },
  DEFAULT_DURATION: '60',
  DURATION_OPTIONS: [
    { value: '15', label: '15 minutes' },
    { value: '30', label: '30 minutes' },
    { value: '60', label: '1 hour' },
    { value: '90', label: '1.5 hours' },
    { value: '120', label: '2 hours' },
    { value: '', label: 'All day' },
  ],
} as const;

export const TIME_GRID_CONFIG = {
  START_HOUR: 6,
  END_HOUR: 23,
  HOUR_HEIGHT: 64,
} as const;

export const STORAGE_KEYS = {
  CALENDAR_COLORS: 'swanson-calendar-colors',
} as const;