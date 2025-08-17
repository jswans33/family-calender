import React from 'react';

// Calendar color utility function
const getCalendarColor = (calendarName?: string) => {
  const colors = {
    home: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      hover: 'hover:bg-blue-200'
    },
    work: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      hover: 'hover:bg-red-200'
    },
    shared: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      hover: 'hover:bg-green-200'
    },
    meals: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      hover: 'hover:bg-yellow-200'
    }
  };
  
  return colors[calendarName as keyof typeof colors] || {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    hover: 'hover:bg-gray-200'
  };
};

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
}

export type CalendarView = 'month' | 'week' | 'day';

export interface DayCellProps {
  day: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  isPast: boolean;
  isWeekend?: boolean; // New prop to identify weekends
  events: CalendarEvent[];
  maxEvents?: number;
  view?: CalendarView;
  onClick?: () => void;
  onEventClick?: (event: CalendarEvent) => void;
}

/**
 * DayCell - The fundamental calendar building block
 *
 * A single day cell that displays:
 * - Day number with proper styling for today/out-of-month
 * - List of events with overflow handling
 * - Hover and focus states
 * - Click handlers for day and individual events
 */
export const DayCell: React.FC<DayCellProps> = ({
  day,
  isToday,
  isCurrentMonth,
  isPast,
  isWeekend = false,
  events,
  maxEvents = 3,
  view = 'month',
  onClick,
  onEventClick,
}) => {
  // Adjust event display based on view
  const getMaxEvents = () => {
    switch (view) {
      case 'month':
        return maxEvents;
      case 'week':
        return 8;
      case 'day':
        return 20;
      default:
        return maxEvents;
    }
  };

  const actualMaxEvents = getMaxEvents();
  const shownEvents = events.slice(0, actualMaxEvents);
  const overflowCount = events.length - shownEvents.length;

  const cellClasses = [
    // Base styles - adapt height based on view
    'border border-gray-200 flex flex-col',
    view === 'month'
      ? 'p-3 h-full'
      : view === 'week'
        ? 'p-2 min-h-[120px]'
        : 'p-4 min-h-[200px]',
    // Background based on state - weekend gets special treatment
    isWeekend && !isToday
      ? 'bg-purple-50'
      : isPast && !isToday
        ? 'bg-gray-100'
        : 'bg-white',
    // Interactive states
    !isPast &&
      'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset',
    isPast ? 'cursor-default' : 'cursor-pointer',
    'transition-colors duration-150',
    // Conditional styles
    isToday && 'bg-blue-50 border-blue-300 ring-1 ring-blue-200',
    !isCurrentMonth && view === 'month' && 'bg-gray-50 text-gray-400',
    isPast && !isToday && !isWeekend && 'text-gray-500',
    isWeekend && !isToday && 'border-purple-200',
  ]
    .filter(Boolean)
    .join(' ');

  const dayNumberClasses = [
    view === 'month'
      ? 'text-sm font-medium mb-2'
      : view === 'week'
        ? 'text-lg font-semibold mb-1'
        : 'text-xl font-bold mb-3',
    'flex-shrink-0',
    isToday
      ? 'text-blue-700 font-bold'
      : isPast && !isToday
        ? 'text-gray-400'
        : 'text-gray-900',
    !isCurrentMonth && view === 'month' && 'text-gray-400',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={cellClasses}
      onClick={onClick}
      aria-label={`Day ${day}, ${events.length} events`}
    >
      {/* Day Number */}
      <div className={dayNumberClasses}>{day}</div>

      {/* Events Container */}
      <div className="flex-1 space-y-1 overflow-hidden">
        {shownEvents.map(event => {
          const calendarColor = getCalendarColor(event.calendar_name);
          return (
            <div
              key={event.id}
              className={`text-xs px-2 py-1 rounded truncate transition-colors ${
                isPast && !isToday
                  ? 'bg-gray-200 text-gray-600'
                  : `${calendarColor.bg} ${calendarColor.text} ${calendarColor.hover}`
              }`}
              onClick={e => {
                e.stopPropagation();
                onEventClick?.(event);
              }}
              title={`${event.time ? event.time + ' ' : ''}${event.title}${event.calendar_name ? ` (${event.calendar_name})` : ''}`}
            >
              {event.time && <span className="font-medium">{event.time} </span>}
              <span>{event.title}</span>
            </div>
          );
        })}

        {/* Overflow Indicator */}
        {overflowCount > 0 && (
          <div className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded font-medium">
            +{overflowCount} more
          </div>
        )}
      </div>
    </button>
  );
};
