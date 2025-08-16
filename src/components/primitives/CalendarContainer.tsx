import React from 'react';

export interface CalendarContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * CalendarContainer - Full-screen calendar layout container
 *
 * Provides:
 * - Full viewport height layout
 * - Flex column structure for header + content
 * - Clean background and proper spacing
 * - Responsive behavior
 */
export const CalendarContainer: React.FC<CalendarContainerProps> = ({
  children,
  className = '',
}) => {
  const containerClasses = [
    // Full available space layout
    'w-full h-full flex flex-col',
    // Background and styling
    'bg-gray-50 rounded-lg',
    // Custom classes
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={containerClasses}>{children}</div>;
};

/**
 * CalendarContent - Content area below header
 */
export interface CalendarContentProps {
  children: React.ReactNode;
  className?: string;
}

export const CalendarContent: React.FC<CalendarContentProps> = ({
  children,
  className = '',
}) => {
  const contentClasses = [
    // Fill remaining space
    'flex-1 flex flex-col',
    // Padding around the grid
    'p-6',
    // Custom classes
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={contentClasses}>{children}</div>;
};
