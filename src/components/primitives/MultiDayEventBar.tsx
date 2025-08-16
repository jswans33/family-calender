import React from 'react';
import { CalendarEvent } from './DayCell';

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

  // Calculate absolute positioning based on grid layout
  // Each cell is approximately 14.28% wide (100% / 7 days)
  const cellWidth = 100 / 7;
  const left = startCol * cellWidth;
  const width = colSpan * cellWidth;

  // Calculate top position based on row
  // Grid has gap-px (1px) between cells, cells are ~78px tall
  const cellHeight = 78;
  const gapSize = 1;
  const topOffset = 25; // Offset from top of cell (below day number)
  const top = row * (cellHeight + gapSize) + topOffset;

  return (
    <div
      className="absolute bg-indigo-500 text-white text-xs px-2 py-1 rounded-md font-medium truncate cursor-pointer hover:bg-indigo-600 transition-colors z-20 shadow-md pointer-events-auto"
      style={{
        top: `${top}px`,
        left: `${left}%`,
        width: `calc(${width}% - 8px)`,
        marginLeft: '4px',
        marginRight: '4px',
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
