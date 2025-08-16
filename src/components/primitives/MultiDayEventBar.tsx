import React from 'react';
import { CalendarEvent } from './DayCell';

export interface MultiDayEventBarProps {
  event: CalendarEvent;
  startCol: number;  // 0-6 for day of week
  colSpan: number;   // Number of days to span
  row: number;       // Week row in calendar
  isFirstSegment: boolean; // True if this is the first segment of the event
  onClick?: (event: CalendarEvent) => void;
}

/**
 * MultiDayEventBar - Renders a spanning bar for multi-day events
 * 
 * A horizontal bar that spans across multiple calendar days to show
 * the duration of all-day events that last multiple days.
 */
export const MultiDayEventBar: React.FC<MultiDayEventBarProps> = ({
  event,
  startCol,
  colSpan,
  row,
  isFirstSegment,
  onClick,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(event);
  };

  return (
    <div
      className="absolute bg-indigo-100 border-2 border-indigo-300 text-indigo-800 text-xs px-2 py-0.5 rounded-md font-medium truncate cursor-pointer hover:bg-indigo-200 transition-colors z-20 shadow-sm"
      style={{
        top: `${row * 120 + 35}px`, // Position below day number
        left: `calc(${(startCol / 7) * 100}% + 4px)`,
        width: `calc(${(colSpan / 7) * 100}% - 8px)`,
      }}
      onClick={handleClick}
      title={`${event.title} (${event.date} - ${event.dtend})`}
    >
      <span className="flex items-center gap-1">
        {!isFirstSegment && <span className="text-indigo-500">→</span>}
        <span className="truncate">{event.title}</span>
        {colSpan < 7 && event.dtend && new Date(event.dtend).getDate() > new Date(event.date).getDate() + colSpan && (
          <span className="text-indigo-500 ml-auto">→</span>
        )}
      </span>
    </div>
  );
};