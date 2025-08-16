import React from 'react';
import { CalendarEvent } from './DayCell';

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
  for (let hour = 6; hour <= 23; hour++) {
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const period = hour < 12 ? 'AM' : 'PM';
    const time24 = `${hour.toString().padStart(2, '0')}:00`;
    
    timeSlots.push({
      hour,
      label: `${hour12} ${period}`,
      time24,
    });
  }

  // Group events by date
  const eventsByDate = new Map<string, CalendarEvent[]>();
  events.forEach(event => {
    const dateKey = event.date;
    if (!eventsByDate.has(dateKey)) {
      eventsByDate.set(dateKey, []);
    }
    eventsByDate.get(dateKey)!.push(event);
  });

  // Convert time string to hour position (6 AM = 0, 7 AM = 1, etc.)
  const getTimePosition = (timeStr?: string): number => {
    if (!timeStr) return 0; // All day events at top
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    const totalMinutes = (hours || 0) * 60 + (minutes || 0);
    const startMinutes = 6 * 60; // 6 AM in minutes
    const position = (totalMinutes - startMinutes) / 60; // Convert to hours from 6 AM
    
    return Math.max(0, Math.min(17, position)); // Clamp between 0-17 (6 AM to 11 PM)
  };

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0] || '';
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Time Labels Column */}
      <div className="w-16 flex-shrink-0 border-r border-gray-200 bg-gray-50">
        <div className="h-16 border-b border-gray-200"></div> {/* Space for date header */}
        {timeSlots.map((slot) => (
          <div
            key={slot.hour}
            className="h-16 flex items-start justify-end pr-2 pt-1 text-xs text-gray-600 border-b border-gray-100"
          >
            {slot.label}
          </div>
        ))}
      </div>

      {/* Days Container */}
      <div className="flex-1 overflow-x-auto">
        <div className={`grid ${view === 'week' ? 'grid-cols-7' : 'grid-cols-1'} gap-px bg-gray-200 h-full`}>
          {dates.map((date, dateIndex) => {
            const dateKey = formatDate(date);
            const dayEvents = eventsByDate.get(dateKey) || [];
            const today = isToday(date);
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            return (
              <div key={dateIndex} className={`flex flex-col ${isWeekend ? 'bg-purple-50' : 'bg-white'}`}>
                {/* Date Header */}
                <div className={`h-16 flex flex-col items-center justify-center border-b border-gray-200 ${
                  today ? 'bg-blue-50 text-blue-700' : 'bg-gray-50'
                }`}>
                  <div className="text-xs text-gray-600 uppercase">
                    {date?.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className={`text-lg font-semibold ${today ? 'text-blue-700' : 'text-gray-900'}`}>
                    {date.getDate()}
                  </div>
                </div>

                {/* Time Slots */}
                <div className="flex-1 relative">
                  {timeSlots.map((slot, slotIndex) => (
                    <div
                      key={slot.hour}
                      className={`h-16 border-b relative cursor-pointer transition-colors ${
                        isWeekend ? 'border-purple-100 hover:bg-purple-100' : 'border-gray-100 hover:bg-blue-50'
                      }`}
                      onClick={() => onTimeSlotClick?.(dateKey, slot.time24)}
                      title={`Create event at ${slot.label}`}
                    />
                  ))}

                  {/* Events Overlay */}
                  <div className="absolute inset-0">
                    {dayEvents.map((event, eventIndex) => {
                      const position = getTimePosition(event.time);
                      const isAllDay = !event.time;
                      
                      return (
                        <div
                          key={event.id}
                          className={`absolute left-1 right-1 px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                            isAllDay
                              ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 h-6 top-1'
                              : 'bg-blue-100 text-blue-800 hover:bg-blue-200 h-12'
                          }`}
                          style={{
                            top: isAllDay ? '4px' : `${position * 64 + 4}px`, // 64px = height of each hour slot
                            zIndex: 10 + eventIndex,
                          }}
                          onClick={() => onEventClick?.(event)}
                          title={`${event.time || 'All day'} - ${event.title}`}
                        >
                          <div className="font-medium truncate">
                            {event.time && <span className="text-xs">{event.time} </span>}
                            {event.title}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};