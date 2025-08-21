import React from 'react';
import { CalendarEvent } from '../../types/shared';
import { useColors } from '../../contexts/ColorContext';
import { getColorShades } from '../../utils/colorUtils';
import { TIME_GRID_CONFIG } from '../../config/constants';
import CalendarService from '../../services/CalendarService';

export interface TimeSlot {
  hour: number;
  label: string;
  time24: string;
}

export interface TimeGridProps {
  dates: Date[];
  events: CalendarEvent[];
  view: 'week' | 'day';
  onEventClick?: (event: CalendarEvent) => void;
  onTimeSlotClick?: (date: string, time: string) => void;
}

/**
 * TimeGrid - Time-based layout for week and day views
 * Shows hourly slots from 6 AM to 11 PM with events positioned by time
 */
export const TimeGrid: React.FC<TimeGridProps> = ({
  dates,
  events,
  view,
  onEventClick,
  onTimeSlotClick,
}) => {
  // Generate time slots from 6 AM to 11 PM
  const timeSlots: TimeSlot[] = [];
  for (
    let hour = TIME_GRID_CONFIG.START_HOUR;
    hour <= TIME_GRID_CONFIG.END_HOUR;
    hour++
  ) {
    const hour12 = hour > 12 ? hour - 12 : hour;
    const period = hour < 12 ? 'AM' : 'PM';
    const time24 = `${hour.toString().padStart(2, '0')}:00`;

    timeSlots.push({
      hour,
      label: `${hour12} ${period}`,
      time24,
    });
  }

  // Calculate dynamic slot height based on container
  // We have 18 time slots (6 AM to 11 PM) plus header
  const slotHeight = `calc((100vh - 200px) / ${timeSlots.length})`;

  // Helper function to format date
  const formatDate = (date: Date): string => {
    if (isNaN(date.getTime())) {
      return '';
    }
    return date.toISOString().split('T')[0] || '';
  };

  // Group events by date - handles multi-day events
  const eventsByDate = new Map<string, CalendarEvent[]>();
  const multiDayEvents: CalendarEvent[] = [];

  events.forEach(event => {
    // Check if this is a multi-day event
    const isAllDay =
      event.time === 'All Day' ||
      event.time === 'all day' ||
      event.time === '12:00 AM' ||
      !event.time;

    // Debug logging
    if (event.title.includes('Morgan') || event.title.includes('Indian')) {
      console.log('Event debug:', {
        title: event.title,
        time: event.time,
        isAllDay,
        date: event.date,
        dtend: event.dtend,
      });
    }

    if (event.dtend) {
      const datePart = event.date.split('T')[0] || event.date;
      const startDate = CalendarService.parseLocal(datePart);
      const endDate = new Date(event.dtend);
      const daysDiff = Math.floor(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff > 1 || (daysDiff === 1 && isAllDay)) {
        // Multi-day event - add to special array
        multiDayEvents.push(event);

        // Also add to each day for week view
        const currentDate = new Date(startDate);
        while (currentDate < endDate) {
          const dateKey = formatDate(currentDate);
          if (!eventsByDate.has(dateKey)) {
            eventsByDate.set(dateKey, []);
          }
          // Mark as multi-day for special rendering
          eventsByDate
            .get(dateKey)!
            .push({ ...event, isMultiDay: true } as any);
          currentDate.setDate(currentDate.getDate() + 1);
        }
      } else {
        // Single day event
        const startKey = formatDate(startDate);
        if (!eventsByDate.has(startKey)) {
          eventsByDate.set(startKey, []);
        }
        eventsByDate.get(startKey)!.push(event);
      }
    } else {
      // Single day event
      const datePart = event.date.split('T')[0] || event.date;
      const startDate = CalendarService.parseLocal(datePart);
      const startKey = formatDate(startDate);
      if (!eventsByDate.has(startKey)) {
        eventsByDate.set(startKey, []);
      }
      eventsByDate.get(startKey)!.push(event);
    }
  });

  // Convert time string to hour position (6 AM = 0, 7 AM = 1, etc.)
  const getTimePosition = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const totalMinutes = (hours || 0) * 60 + (minutes || 0);
    const startMinutes = TIME_GRID_CONFIG.START_HOUR * 60;
    const position = (totalMinutes - startMinutes) / 60;

    return Math.max(
      0,
      Math.min(
        TIME_GRID_CONFIG.END_HOUR - TIME_GRID_CONFIG.START_HOUR,
        position
      )
    );
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Time Labels Column */}
      <div className="w-16 flex-shrink-0 border-r border-gray-200 bg-gray-50">
        <div className="h-16 border-b border-gray-200"></div>{' '}
        {/* Space for date header */}
        {timeSlots.map(slot => (
          <div
            key={slot.hour}
            className="flex items-start justify-end pr-2 pt-1 text-xs text-gray-600 border-b border-gray-100"
            style={{ height: slotHeight, minHeight: '3rem' }}
          >
            {slot.label}
          </div>
        ))}
      </div>

      {/* Days Container */}
      <div className="flex-1 overflow-x-auto relative">
        {/* Multi-day Events Overlay for Week View */}
        {view === 'week' && multiDayEvents.length > 0 && (
          <div className="absolute top-0 left-0 right-0 z-10 p-2">
            <div className="grid grid-cols-7 gap-px">
              {dates.map((date, dateIndex) => {
                const _dateKey = formatDate(date);
                const dayMultiEvents = multiDayEvents.filter(event => {
                  const startDate = CalendarService.parseLocal(
                    event.date.split('T')[0] || event.date
                  );
                  const endDate = event.dtend
                    ? CalendarService.parseLocal(
                        event.dtend.split('T')[0] || event.dtend
                      )
                    : startDate;
                  return date >= startDate && date <= endDate;
                });

                return (
                  <div key={dateIndex} className="min-h-[32px] space-y-1">
                    {dayMultiEvents.map(event => (
                      <div
                        key={event.id}
                        className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 truncate cursor-pointer hover:bg-blue-200"
                        title={event.title}
                        onClick={() => onEventClick?.(event)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onEventClick?.(event);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Event: ${event.title}`}
                      >
                        {event.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div
          className={`grid ${view === 'week' ? 'grid-cols-7' : 'grid-cols-1'} gap-px bg-gray-200 h-full`}
          style={{
            paddingTop:
              view === 'week' && multiDayEvents.length > 0 ? '60px' : '0',
          }}
        >
          {dates.map((date, dateIndex) => {
            const dateKey = formatDate(date);
            const dayEvents = eventsByDate.get(dateKey) || [];
            const today = isToday(date);
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            return (
              <div
                key={dateIndex}
                className={`flex flex-col ${isWeekend ? 'bg-purple-50' : 'bg-white'}`}
              >
                {/* Date Header */}
                <div
                  className={`h-16 flex flex-col items-center justify-center border-b border-gray-200 ${
                    today ? 'bg-blue-50 text-blue-700' : 'bg-gray-50'
                  }`}
                >
                  <div className="text-xs text-gray-600 uppercase">
                    {date?.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div
                    className={`text-lg font-semibold ${today ? 'text-blue-700' : 'text-gray-900'}`}
                  >
                    {date.getDate()}
                  </div>
                </div>

                {/* Time Slots */}
                <div className="flex-1 relative">
                  {timeSlots.map((slot, slotIndex) => (
                    <div
                      key={slot.hour}
                      className={`border-b relative cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
                        // Highlight 7am-7pm business hours
                        slot.hour >= 7 && slot.hour <= 19
                          ? isWeekend
                            ? 'border-purple-200 bg-purple-25 hover:bg-purple-100'
                            : 'border-gray-200 bg-blue-25 hover:bg-blue-50'
                          : isWeekend
                            ? 'border-purple-100 bg-purple-10 hover:bg-purple-50'
                            : 'border-gray-100 bg-gray-25 hover:bg-gray-50'
                      }`}
                      style={{ height: slotHeight, minHeight: '3rem' }}
                      onClick={() => onTimeSlotClick?.(dateKey, slot.time24)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onTimeSlotClick?.(dateKey, slot.time24);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Create event at ${slot.label} on ${date.toLocaleDateString()}`}
                      title={`Create event at ${slot.label}`}
                    />
                  ))}

                  {/* Events Overlay */}
                  <TimeGridEvents
                    events={dayEvents}
                    getTimePosition={getTimePosition}
                    slotHeight={slotHeight}
                    {...(onEventClick && { onEventClick })}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Separate component for events to use hooks
const TimeGridEvents: React.FC<{
  events: CalendarEvent[];
  getTimePosition: (timeStr: string) => number;
  slotHeight?: string;
  onEventClick?: (event: CalendarEvent) => void;
}> = ({ events, getTimePosition, slotHeight, onEventClick }) => {
  const { getCalendarColor } = useColors();

  // Separate all-day events from timed events (modular, clear separation)
  const allDayEvents = events
    .filter(
      event => !event.time || event.time === '' || event.time === 'All Day'
    )
    .filter(event => !(event as any).isMultiDay); // Don't show multi-day events here

  const timedEvents = events.filter(
    event => event.time && event.time !== '' && event.time !== 'All Day'
  );

  // Group timed events by time to handle overlapping
  const eventsByTime = new Map<string, CalendarEvent[]>();
  timedEvents.forEach(event => {
    const timeKey = event.time!;
    if (!eventsByTime.has(timeKey)) {
      eventsByTime.set(timeKey, []);
    }
    eventsByTime.get(timeKey)!.push(event);
  });

  return (
    <>
      {/* All-day events section at the top */}
      {allDayEvents.length > 0 && (
        <div className="absolute top-0 left-0 right-0 flex flex-wrap gap-1 p-1 bg-gray-50 border-b border-gray-200 z-20">
          {allDayEvents.map(event => {
            const calendarName = event.calendar_name || 'home';
            const calendarColor = getCalendarColor(calendarName);
            const colorShades = getColorShades(calendarColor);

            return (
              <div
                key={event.id}
                className="px-2 py-1 text-xs rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset transition-colors border-l-4"
                style={{
                  backgroundColor: colorShades.lightBg,
                  color: colorShades.textColor,
                  borderLeftColor: calendarColor,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = colorShades.hoverBg;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = colorShades.lightBg;
                }}
                onClick={() => onEventClick?.(event)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onEventClick?.(event);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`All day - ${event.title}${event.calendar_name ? ` (${event.calendar_name})` : ''}`}
              >
                <div className="font-medium truncate">{event.title}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Timed events in the grid */}
      <div className="absolute inset-0">
        {Array.from(eventsByTime.entries()).flatMap(([timeKey, timeEvents]) =>
          timeEvents.map((event, indexInTimeSlot) => {
            const position = getTimePosition(event.time!);
            const calendarName = event.calendar_name || 'home';
            const calendarColor = getCalendarColor(calendarName);
            const colorShades = getColorShades(calendarColor);

            // Calculate event duration in hours
            let eventDuration = 1; // Default 1 hour
            if (event.duration) {
              // Parse duration like "PT8H0M" or "PT1H0M"
              const durationMatch = event.duration.match(/PT(\d+)H/);
              if (durationMatch && durationMatch[1]) {
                eventDuration = parseInt(durationMatch[1], 10);
              }
            } else if (event.end && event.start) {
              // Calculate from start and end times
              const startTime = new Date(event.start);
              const endTime = new Date(event.end);
              eventDuration =
                (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
            } else if (event.dtend && event.date && event.time) {
              // Calculate from date/time and dtend
              const startTime = new Date(
                `${event.date.split('T')[0]}T${event.time}:00`
              );
              const endTime = new Date(event.dtend);
              eventDuration =
                (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
            }

            // Calculate horizontal positioning for overlapping events
            const totalEventsAtTime = timeEvents.length;
            const eventWidth =
              totalEventsAtTime > 1
                ? `${95 / totalEventsAtTime}%`
                : 'calc(100% - 8px)';
            const leftOffset =
              totalEventsAtTime > 1
                ? `${(indexInTimeSlot * 95) / totalEventsAtTime}%`
                : '4px';

            // Calculate dynamic top position and height based on duration
            const topPosition = slotHeight
              ? `calc(${position} * ${slotHeight} + 4px)`
              : `${position * TIME_GRID_CONFIG.HOUR_HEIGHT + 4}px`;

            const eventHeight = slotHeight
              ? `calc(${eventDuration} * ${slotHeight} - 8px)`
              : `${eventDuration * TIME_GRID_CONFIG.HOUR_HEIGHT - 8}px`;

            return (
              <div
                key={event.id}
                className="absolute px-2 py-1 text-xs rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset transition-colors border-l-4 overflow-hidden"
                style={{
                  backgroundColor: colorShades.lightBg,
                  color: colorShades.textColor,
                  borderLeftColor: calendarColor,
                  top: topPosition,
                  height: eventHeight,
                  left: leftOffset,
                  width: eventWidth,
                  zIndex: 10 + indexInTimeSlot,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = colorShades.hoverBg;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = colorShades.lightBg;
                }}
                onClick={() => onEventClick?.(event)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onEventClick?.(event);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`${event.time || 'All day'} - ${event.title}${event.calendar_name ? ` (${event.calendar_name})` : ''}`}
              >
                <div className="flex flex-col">
                  <div className="font-bold text-xs">
                    {event.time || 'All day'}
                    {event.end &&
                      ` - ${new Date(event.end).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}`}
                  </div>
                  <div className="font-medium truncate">{event.title}</div>
                  {event.duration && (
                    <div className="text-xs opacity-75">
                      Duration: {event.duration}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
};
