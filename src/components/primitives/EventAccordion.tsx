import React, { useState } from 'react';
import { useColors } from '../../contexts/ColorContext';
import { CalendarEvent } from './DayCell';

interface EventGroup {
  calendarName: string;
  events: CalendarEvent[];
}

interface EventAccordionProps {
  eventGroups: EventGroup[];
  selectedEvent: CalendarEvent | null;
  onEventClick: (event: CalendarEvent) => void;
}

const EventAccordion: React.FC<EventAccordionProps> = ({
  eventGroups,
  selectedEvent,
  onEventClick,
}) => {
  const { getCalendarColor } = useColors();
  const [expandedCalendars, setExpandedCalendars] = useState<Set<string>>(
    new Set(['home', 'work', 'meals']) // Start with all expanded
  );

  const toggleCalendar = (calendarName: string) => {
    const newExpanded = new Set(expandedCalendars);
    if (newExpanded.has(calendarName)) {
      newExpanded.delete(calendarName);
    } else {
      newExpanded.add(calendarName);
    }
    setExpandedCalendars(newExpanded);
  };

  const getCalendarLabel = (name: string) => {
    const labels: Record<string, string> = {
      home: 'Home',
      work: 'Work', 
      shared: 'Shared',
      meals: 'Meals',
    };
    return labels[name] || name;
  };

  const formatEventTime = (event: CalendarEvent) => {
    const eventDate = new Date(event.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    let dateLabel = '';
    if (daysDiff === 0) dateLabel = 'Today';
    else if (daysDiff === 1) dateLabel = 'Tomorrow';
    else if (daysDiff === -1) dateLabel = 'Yesterday';
    else dateLabel = new Date(event.date).toLocaleDateString();
    
    return {
      dateLabel,
      time: event.time || 'All day'
    };
  };

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Upcoming Events
      </h2>
      
      {eventGroups.map(group => {
        const calendarColor = getCalendarColor(group.calendarName);
        const isExpanded = expandedCalendars.has(group.calendarName);
        
        return (
          <div key={group.calendarName} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Calendar Header */}
            <button
              onClick={() => toggleCalendar(group.calendarName)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: calendarColor }}
                />
                <span className="font-medium text-gray-900">
                  {getCalendarLabel(group.calendarName)}
                </span>
                <span className="text-sm text-gray-500">
                  ({group.events.length})
                </span>
              </div>
              <svg 
                className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Events List */}
            {isExpanded && (
              <div className="divide-y divide-gray-100">
                {group.events.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500 italic">
                    No upcoming events
                  </div>
                ) : (
                  group.events.map(event => {
                    const { dateLabel, time } = formatEventTime(event);
                    const isSelected = selectedEvent?.id === event.id;
                    
                    return (
                      <div
                        key={event.id}
                        onClick={() => onEventClick(event)}
                        className={`px-4 py-3 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50 border-l-4 border-blue-500'
                            : 'hover:bg-gray-50 border-l-4 border-transparent'
                        }`}
                      >
                        <div className="font-medium text-gray-900 text-sm mb-1">
                          {event.title}
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          <div className="font-medium">{dateLabel}</div>
                          <div>{time}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default EventAccordion;