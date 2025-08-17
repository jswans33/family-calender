import React from 'react';
import { useColors } from '../../contexts/ColorContext';
import { getColorShades } from '../../utils/colorUtils';
import { CalendarEvent, CalendarView } from '../../types/shared';
import { EVENT_CONFIG } from '../../config/constants';
import CalendarService from '../../services/CalendarService';

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
    return EVENT_CONFIG.MAX_EVENTS[view] || maxEvents;
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

      {/* Events Container - positioned based on view type */}
      <div className={`flex-1 space-y-1 overflow-hidden ${view === 'month' ? 'mt-12' : ''}`}>
        <EventList 
          events={shownEvents}
          isPast={isPast}
          isToday={isToday}
          onEventClick={onEventClick}
        />

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

// Separate component for event list to use hooks
const EventList: React.FC<{
  events: CalendarEvent[];
  isPast: boolean;
  isToday: boolean;
  onEventClick?: (event: CalendarEvent) => void;
}> = ({ events, isPast, isToday, onEventClick }) => {
  const { getCalendarColor } = useColors();
  
  return (
    <>
      {events.map(event => {
        const calendarName = event.calendar_name || 'home';
        const calendarColor = getCalendarColor(calendarName);
        const colorShades = getColorShades(calendarColor);
        
        return (
          <div
            key={event.id}
            className="text-xs px-2 py-1 rounded truncate transition-colors border-l-4 cursor-pointer"
            style={{
              backgroundColor: isPast && !isToday ? '#f3f4f6' : colorShades.lightBg,
              color: isPast && !isToday ? '#6b7280' : colorShades.textColor,
              borderLeftColor: isPast && !isToday ? '#9ca3af' : calendarColor,
            }}
            onMouseEnter={e => {
              if (!(isPast && !isToday)) {
                e.currentTarget.style.backgroundColor = colorShades.hoverBg;
              }
            }}
            onMouseLeave={e => {
              if (!(isPast && !isToday)) {
                e.currentTarget.style.backgroundColor = colorShades.lightBg;
              }
            }}
            onClick={e => {
              e.stopPropagation();
              onEventClick?.(event);
            }}
            title={`${event.time ? (CalendarService.formatTimeTo12h(event.time) || event.time) + ' ' : ''}${event.title}${event.calendar_name ? ` (${event.calendar_name})` : ''}`}
          >
            {event.time && <span className="font-medium">{CalendarService.formatTimeTo12h(event.time) || event.time} </span>}
            <span>{event.title}</span>
          </div>
        );
      })}
    </>
  );
};
