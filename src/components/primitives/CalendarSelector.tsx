import React, { useState } from 'react';
import { useColors } from '../../contexts/ColorContext';
import ColorPicker from './ColorPicker';

import { CalendarOption, CalendarName } from '../../types/shared';

interface CalendarSelectorProps {
  calendars: CalendarOption[];
  selectedCalendar: string | null;
  onCalendarChange: (calendar: string | null) => void;
  isLoading?: boolean;
}

import { CALENDAR_CONFIG } from '../../config/constants';

const CALENDAR_LABELS = CALENDAR_CONFIG.LABELS;

const CalendarSelector: React.FC<CalendarSelectorProps> = ({
  calendars,
  selectedCalendar,
  onCalendarChange,
  isLoading = false,
}) => {
  const { getCalendarColor } = useColors();
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);

  const handleColorButtonClick = (e: React.MouseEvent, calendarName: string) => {
    e.stopPropagation();
    setColorPickerOpen(calendarName);
  };

  return (
    <>
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
          const calendarColor = getCalendarColor(calendar.name);
          const label = CALENDAR_LABELS[calendar.name as CalendarName] || calendar.name;
          
          return (
            <div key={calendar.name} className="relative group">
              <button
                onClick={() => onCalendarChange(calendar.name)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCalendar === calendar.name
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                disabled={isLoading}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: calendarColor }}
                  ></div>
                  <span>{label}</span>
                  {!isLoading && (
                    <span className="text-xs opacity-75">({calendar.count})</span>
                  )}
                </div>
              </button>
              
              {/* Color customization button */}
              <button
                onClick={(e) => handleColorButtonClick(e, calendar.name)}
                className="absolute -top-1 -right-1 w-5 h-5 bg-white border border-gray-300 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50"
                title={`Customize ${label} color`}
              >
                <svg className="w-3 h-3 mx-auto text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a2 2 0 002 2V4a2 2 0 012-2h11a2 2 0 00-2-2H4z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M6 4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2V4zm2 0v8h8V4H8z" clipRule="evenodd" />
                  <circle cx="10" cy="8" r="2" />
                </svg>
              </button>
            </div>
          );
        })}
        
        {isLoading && (
          <div className="px-3 py-2 text-sm text-gray-500">
            Loading calendars...
          </div>
        )}
      </div>

      {/* Color Picker Modal */}
      {colorPickerOpen && (
        <ColorPicker
          calendarName={colorPickerOpen}
          onClose={() => setColorPickerOpen(null)}
        />
      )}
    </>
  );
};

export default CalendarSelector;