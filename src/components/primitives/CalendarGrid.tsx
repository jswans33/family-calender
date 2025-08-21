import React from 'react';

export interface CalendarGridProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * CalendarGrid - Container for the 6x7 calendar layout
 *
 * Provides:
 * - CSS Grid with 7 columns for days of week
 * - 6 rows for weeks of the month
 * - Consistent spacing between cells
 * - Responsive behavior
 */
export const CalendarGrid: React.FC<CalendarGridProps> = ({
  children,
  className = '',
}) => {
  const gridClasses = [
    // Grid layout - 7 columns, 6 rows of equal height
    'grid grid-cols-7 grid-rows-6 gap-px',
    // Container styling
    'bg-gray-300 rounded-lg overflow-hidden shadow-lg',
    // Full height to fill parent
    'h-full w-full',
    // Custom classes
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={gridClasses} role="grid">
      {children}
    </div>
  );
};

/**
 * WeekdayHeader - Row of day names
 */
export interface WeekdayHeaderProps {
  weekdays: string[];
  className?: string;
}

export const WeekdayHeader: React.FC<WeekdayHeaderProps> = ({
  weekdays,
  className = '',
}) => {
  const headerClasses = ['grid grid-cols-7 gap-px bg-gray-300 mb-px', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={headerClasses}>
      {weekdays.map(day => (
        <div
          key={day}
          className="bg-gray-100 flex items-center justify-center h-8 sm:h-10 text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wide"
          role="columnheader"
          aria-label={day}
        >
          {day}
        </div>
      ))}
    </div>
  );
};
