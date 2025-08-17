import React from 'react';
import { CalendarEvent } from '../../types/shared';

export interface MultiDayEventBarProps {
  event: CalendarEvent;
  startCol: number; // 0-6 for day of week
  colSpan: number; // Number of days to span
  row: number; // Week row in calendar
  isFirstSegment: boolean; // True if this is the first segment of the event
  onClick?: ((event: CalendarEvent) => void) | undefined;
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

  // Use CSS Grid positioning instead of absolute positioning
  // This locks the element to the actual grid cells regardless of zoom
  const gridColumn = `${startCol + 1} / span ${colSpan}`; // CSS Grid is 1-indexed
  const gridRow = `${row + 1}`; // CSS Grid is 1-indexed


  return (
    <div
      className="bg-indigo-500 text-white text-xs px-2 py-1 rounded-md font-medium truncate cursor-pointer hover:bg-indigo-600 transition-colors z-20 shadow-md pointer-events-auto self-start mt-8"
      style={{
        gridColumn,
        gridRow,
      }}
      onClick={handleClick}
      title={`${event.title} (${event.date} - ${event.dtend})`}
    >
      <span className="flex items-center gap-1">
        {!isFirstSegment && <span className="text-indigo-200">→</span>}
        <span className="truncate">{event.title}</span>
        {colSpan < 7 &&
          event.dtend &&
          new Date(event.dtend).getDate() >
            new Date(event.date).getDate() + colSpan && (
            <span className="text-indigo-200 ml-auto">→</span>
          )}
      </span>
    </div>
  );
};
