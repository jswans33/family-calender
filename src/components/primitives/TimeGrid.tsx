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
  for (let hour = TIME_GRID_CONFIG.START_HOUR; hour <= TIME_GRID_CONFIG.END_HOUR; hour++) {
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const period = hour < 12 ? 'AM' : 'PM';
    const time24 = `${hour.toString().padStart(2, '0')}:00`;

    timeSlots.push({
      hour,
      label: `${hour12} ${period}`,
      time24,
    });
  }

  // Helper function to format date
  const formatDate = (date: Date): string => {
    if (isNaN(date.getTime())) {
      console.warn('Invalid date passed to formatDate:', date);
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

    if (event.dtend) {
      const datePart = event.date.split('T')[0];
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
      const datePart = event.date.split('T')[0];
      const startDate = CalendarService.parseLocal(datePart);
      const startKey = formatDate(startDate);
      if (!eventsByDate.has(startKey)) {
        eventsByDate.set(startKey, []);
      }
      eventsByDate.get(startKey)!.push(event);
    }
  });

  // Convert time string to hour position (6 AM = 0, 7 AM = 1, etc.)
  const getTimePosition = (timeStr?: string): number => {
    if (!timeStr) return 0; // All day events at top

    const [hours, minutes] = timeStr.split(':').map(Number);
    const totalMinutes = (hours || 0) * 60 + (minutes || 0);
    const startMinutes = TIME_GRID_CONFIG.START_HOUR * 60;
    const position = (totalMinutes - startMinutes) / 60;

    return Math.max(0, Math.min(TIME_GRID_CONFIG.END_HOUR - TIME_GRID_CONFIG.START_HOUR, position));
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
            className="h-16 flex items-start justify-end pr-2 pt-1 text-xs text-gray-600 border-b border-gray-100"
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
                const dateKey = formatDate(date);
                const dayMultiEvents = multiDayEvents.filter(event => {
                  const startDate = CalendarService.parseLocal(event.date.split('T')[0]);
                  const endDate = event.dtend ? CalendarService.parseLocal(event.dtend.split('T')[0]) : startDate;
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
          style={{ paddingTop: view === 'week' && multiDayEvents.length > 0 ? '60px' : '0' }}
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
                      className={`h-16 border-b relative cursor-pointer transition-colors ${
                        // Highlight 7am-7pm business hours
                        slot.hour >= 7 && slot.hour <= 19
                          ? isWeekend
                            ? 'border-purple-200 bg-purple-25 hover:bg-purple-100'
                            : 'border-gray-200 bg-blue-25 hover:bg-blue-50'
                          : isWeekend
                            ? 'border-purple-100 bg-purple-10 hover:bg-purple-50'
                            : 'border-gray-100 bg-gray-25 hover:bg-gray-50'
                      }`}
                      onClick={() => onTimeSlotClick?.(dateKey, slot.time24)}
                      title={`Create event at ${slot.label}`}
                    />
                  ))}

                  {/* Events Overlay */}
                  <TimeGridEvents
                    events={dayEvents}
                    getTimePosition={getTimePosition}
                    onEventClick={onEventClick}
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
  getTimePosition: (timeStr?: string) => number;
  onEventClick?: (event: CalendarEvent) => void;
}> = ({ events, getTimePosition, onEventClick }) => {
  const { getCalendarColor } = useColors();
  
  return (
    <div className="absolute inset-0">
      {events.map((event, eventIndex) => {
        const position = getTimePosition(event.time);
        const isAllDay = !event.time;
        const calendarName = event.calendar_name || 'home';
        const calendarColor = getCalendarColor(calendarName);
        const colorShades = getColorShades(calendarColor);

        return (
          <div
            key={event.id}
            className={`absolute left-1 right-1 px-2 py-1 text-xs rounded cursor-pointer transition-colors border-l-4 ${
              isAllDay ? 'h-6' : 'h-12'
            }`}
            style={{
              backgroundColor: colorShades.lightBg,
              color: colorShades.textColor,
              borderLeftColor: calendarColor,
              top: isAllDay ? '4px' : `${position * TIME_GRID_CONFIG.HOUR_HEIGHT + 4}px`,
              zIndex: 10 + eventIndex,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = colorShades.hoverBg;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = colorShades.lightBg;
            }}
            onClick={() => onEventClick?.(event)}
            title={`${event.time || 'All day'} - ${event.title}${event.calendar_name ? ` (${event.calendar_name})` : ''}`}
          >
            <div className="font-medium truncate">
              {event.time && (
                <span className="text-xs">{event.time} </span>
              )}
              {event.title}
            </div>
          </div>
        );
      })}
    </div>
  );
};
