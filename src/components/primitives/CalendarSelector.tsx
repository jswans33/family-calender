import React from 'react';

interface CalendarOption {
  name: string;
  count: number;
}

interface CalendarSelectorProps {
  calendars: CalendarOption[];
  selectedCalendar: string | null;
  onCalendarChange: (calendar: string | null) => void;
  isLoading?: boolean;
}

const CALENDAR_COLORS = {
  home: 'bg-blue-500',
  work: 'bg-red-500', 
  shared: 'bg-green-500',
  meals: 'bg-yellow-500',
} as const;

const CALENDAR_LABELS = {
  home: 'Home',
  work: 'Work',
  shared: 'Shared',
  meals: 'Meals',
} as const;

const CalendarSelector: React.FC<CalendarSelectorProps> = ({
  calendars,
  selectedCalendar,
  onCalendarChange,
  isLoading = false,
}) => {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {/* All Calendars Option */}
      <button
        onClick={() => onCalendarChange(null)}
        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          selectedCalendar === null
            ? 'bg-gray-800 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
        disabled={isLoading}
      >
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 via-red-500 via-green-500 to-yellow-500"></div>
          <span>All Calendars</span>
          {!isLoading && (
            <span className="text-xs opacity-75">
              ({calendars.reduce((sum, cal) => sum + cal.count, 0)})
            </span>
          )}
        </div>
      </button>

      {/* Individual Calendar Options */}
      {calendars.map(calendar => {
        const colorClass = CALENDAR_COLORS[calendar.name as keyof typeof CALENDAR_COLORS] || 'bg-gray-500';
        const label = CALENDAR_LABELS[calendar.name as keyof typeof CALENDAR_LABELS] || calendar.name;
        
        return (
          <button
            key={calendar.name}
            onClick={() => onCalendarChange(calendar.name)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCalendar === calendar.name
                ? 'bg-gray-800 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            disabled={isLoading}
          >
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${colorClass}`}></div>
              <span>{label}</span>
              {!isLoading && (
                <span className="text-xs opacity-75">({calendar.count})</span>
              )}
            </div>
          </button>
        );
      })}
      
      {isLoading && (
        <div className="px-3 py-2 text-sm text-gray-500">
          Loading calendars...
        </div>
      )}
    </div>
  );
};

export default CalendarSelector;