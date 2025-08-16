import React from 'react';

export type CalendarView = 'month' | 'week' | 'day';

export interface ViewContainerProps {
  view: CalendarView;
  children: React.ReactNode;
  className?: string;
}

/**
 * ViewContainer - Adaptive container that changes layout based on view type
 *
 * Month: Full grid layout
 * Week: Single row layout
 * Day: Single column layout
 */
export const ViewContainer: React.FC<ViewContainerProps> = ({
  view,
  children,
  className = '',
}) => {
  const getLayoutClasses = () => {
    switch (view) {
      case 'month':
        return 'grid grid-cols-7 grid-rows-6 gap-px';
      case 'week':
        return 'grid grid-cols-7 grid-rows-1 gap-px';
      case 'day':
        return 'flex flex-col gap-2';
      default:
        return 'grid grid-cols-7 grid-rows-6 gap-px';
    }
  };

  const containerClasses = [
    getLayoutClasses(),
    'bg-gray-300 rounded-lg overflow-hidden shadow-lg',
    'h-full w-full',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses} role="grid">
      {children}
    </div>
  );
};
