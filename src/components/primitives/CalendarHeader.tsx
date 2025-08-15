import React from 'react';

export interface CalendarHeaderProps {
  title: string;
  onPrevious?: () => void;
  onNext?: () => void;
  onToday?: () => void;
  showNavigation?: boolean;
  className?: string;
}

/**
 * CalendarHeader - Month/year title with navigation
 * 
 * Features:
 * - Large, prominent month/year display
 * - Previous/next month navigation arrows
 * - Optional "Today" button
 * - Clean, professional styling
 */
export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  title,
  onPrevious,
  onNext,
  onToday,
  showNavigation = true,
  className = '',
}) => {
  const headerClasses = [
    'bg-white border-b border-gray-200 px-6 py-4',
    'flex items-center justify-between shadow-sm',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={headerClasses}>
      {/* Title */}
      <h1 className="text-2xl font-semibold text-gray-900">
        {title}
      </h1>

      {/* Navigation */}
      {showNavigation && (
        <div className="flex items-center space-x-2">
          {/* Today Button */}
          {onToday && (
            <button
              type="button"
              onClick={onToday}
              className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
            >
              Today
            </button>
          )}

          {/* Previous Month */}
          {onPrevious && (
            <button
              type="button"
              onClick={onPrevious}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Previous month"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Next Month */}
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Next month"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
};