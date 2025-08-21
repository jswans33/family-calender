import React, { useMemo, useState } from 'react';
import {
  CalendarContainer,
  CalendarContent,
} from './primitives/CalendarContainer';
import { CalendarHeader } from './primitives/CalendarHeader';
import { ViewContainer } from './primitives/ViewContainer';
import { WeekdayHeader } from './primitives/CalendarGrid';
import { DayCell } from './primitives/DayCell';
import { CalendarEvent, CalendarView } from '../types/shared';
import { TimeGrid } from './primitives/TimeGrid';
import { MultiDayEventBar } from './primitives/MultiDayEventBar';
import CalendarSelector from './primitives/CalendarSelector';

interface CalendarProps {
  events: CalendarEvent[];
  calendars: Array<{ name: string; count: number }>;
  selectedCalendar: string | null;
  onCalendarChange: (calendar: string | null) => void;
  isLoadingCalendars?: boolean;
  year?: number; // default = now
  month?: number; // 0-11, default = now
  startOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun, default=1
  maxEventsPerDay?: number; // default=3
  view?: CalendarView; // default = 'month'
  selectedDate?: string | null; // ISO date string for day view
  onDayClick?: (dateISO: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onTimeSlotClick?: (date: string, time: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  hideControls?: boolean; // Hide calendar selector and search bar
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const dateKey = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function parseLocal(date: string, time?: string): Date {
  // Safe for 'YYYY-MM-DD' and optional 'HH:mm' without UTC shift
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return new Date(NaN);
  if (!time) return new Date(y, m - 1, d);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
}

function minutesFromTime(t?: string): number {
  if (!t) return -1;
  const [hh, mm] = t.split(':').map(Number);
  return (hh || 0) * 60 + (mm || 0);
}

function rotatedDays(startOfWeek: number) {
  const out: string[] = [];
  for (let i = 0; i < 7; i++) out.push(DOW[(i + startOfWeek) % 7] || 'Sun');
  return out;
}

function monthGridDates(
  year: number,
  month: number,
  startOfWeek: number
): Date[] {
  const first = new Date(year, month, 1);
  const dow = first.getDay(); // 0=Sun
  const lead = (dow - startOfWeek + 7) % 7;
  const gridStart = new Date(year, month, 1 - lead);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }
  return cells;
}

const Calendar: React.FC<CalendarProps> = ({
  events,
  calendars,
  selectedCalendar,
  onCalendarChange,
  isLoadingCalendars = false,
  year,
  month,
  startOfWeek = 1,
  maxEventsPerDay = 3,
  view = 'month',
  selectedDate,
  onDayClick,
  onEventClick,
  onTimeSlotClick,
  searchQuery = '',
  onSearchChange,
  hideControls = false,
}) => {
  const [currentYear, setCurrentYear] = useState(
    year ?? new Date().getFullYear()
  );
  const [currentMonth, setCurrentMonth] = useState(
    month ?? new Date().getMonth()
  );
  const [currentDate, setCurrentDate] = useState(new Date().getDate()); // Track the specific date for day/week navigation
  const currentView = view; // Use the view prop directly

  // Update calendar position when selectedDate changes
  React.useEffect(() => {
    if (selectedDate) {
      // Parse date string manually to avoid timezone issues
      const parts = selectedDate.split('-').map(Number);
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      if (year && month && day) {
        setCurrentYear(year);
        setCurrentMonth(month - 1); // month is 0-based
        setCurrentDate(day);
      }
    }
  }, [selectedDate]);

  const now = new Date();
  const headers = useMemo(() => rotatedDays(startOfWeek), [startOfWeek]);

  // Generate dates based on current view
  const dates = useMemo(() => {
    switch (currentView) {
      case 'month':
        return monthGridDates(currentYear, currentMonth, startOfWeek);
      case 'week': {
        // Get the week containing the current date
        const targetDate = new Date(currentYear, currentMonth, currentDate);
        const weekStart = new Date(targetDate);
        const dayOfWeek = targetDate.getDay();
        const daysFromStart = (dayOfWeek - startOfWeek + 7) % 7;
        weekStart.setDate(targetDate.getDate() - daysFromStart);

        const weekDates = [];
        for (let i = 0; i < 7; i++) {
          const date = new Date(weekStart);
          date.setDate(weekStart.getDate() + i);
          weekDates.push(date);
        }
        return weekDates;
      }
      case 'day':
        // Show the specific current date
        return [new Date(currentYear, currentMonth, currentDate)];
      default:
        return monthGridDates(currentYear, currentMonth, startOfWeek);
    }
  }, [currentYear, currentMonth, currentDate, currentView, startOfWeek]);

  // Filter events based on search query
  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;

    const query = searchQuery.toLowerCase().trim();
    return events.filter(
      event =>
        event.title.toLowerCase().includes(query) ||
        event.description?.toLowerCase().includes(query) ||
        event.location?.toLowerCase().includes(query) ||
        event.categories?.some(cat => cat.toLowerCase().includes(query))
    );
  }, [events, searchQuery]);

  // Event bucketing - separates single-day and multi-day events
  const { singleDayBuckets, multiDayEvents } = useMemo(() => {
    const singleDayMap = new Map<string, CalendarEvent[]>();
    const multiDayEvents: Array<{
      event: CalendarEvent;
      startDate: Date;
      endDate: Date;
    }> = [];

    for (const e of filteredEvents) {
      // For all-day events, don't pass time to parseLocal
      const isAllDay =
        e.time === 'All Day' ||
        e.time === 'all day' ||
        !e.time ||
        e.time === '12:00 AM';
      const datePart = e.date.split('T')[0];
      if (!datePart) continue; // Skip if date is malformed
      const startDate = parseLocal(datePart); // Parse just the date part
      const startKey = dateKey(startDate);

      // Check if this is a multi-day event based on dtend
      if (e.dtend) {
        const endDate = new Date(e.dtend);
        const startDateClean = parseLocal(datePart); // Use datePart, not e.date

        // Check if event spans multiple days (more than 24 hours)
        const daysDiff = Math.floor(
          (endDate.getTime() - startDateClean.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysDiff > 1 || (daysDiff === 1 && isAllDay)) {
          // Multi-day event - store separately for spanning rendering
          multiDayEvents.push({ event: e, startDate, endDate });
        } else {
          // Single day event
          if (!singleDayMap.has(startKey)) singleDayMap.set(startKey, []);
          singleDayMap.get(startKey)!.push(e);
        }
      } else {
        // Single day event
        if (!singleDayMap.has(startKey)) singleDayMap.set(startKey, []);
        singleDayMap.get(startKey)!.push(e);
      }
    }

    // Sort events within each day
    for (const arr of singleDayMap.values()) {
      arr.sort((a, b) => minutesFromTime(a.time) - minutesFromTime(b.time));
    }

    return { singleDayBuckets: singleDayMap, multiDayEvents };
  }, [filteredEvents]);

  // Generate appropriate title based on view
  const getViewTitle = () => {
    switch (currentView) {
      case 'month':
        return `${MONTHS[currentMonth]} ${currentYear}`;
      case 'week':
        if (dates.length > 0) {
          const firstDay = dates[0];
          const lastDay = dates[6] || dates[0]; // Fallback to first day if no 6th day
          if (
            firstDay &&
            lastDay &&
            firstDay.getMonth() === lastDay.getMonth()
          ) {
            return `${MONTHS[firstDay.getMonth()]} ${firstDay.getDate()}-${lastDay.getDate()}, ${firstDay.getFullYear()}`;
          } else if (firstDay && lastDay) {
            return `${MONTHS[firstDay.getMonth()]} ${firstDay.getDate()} - ${MONTHS[lastDay.getMonth()]} ${lastDay.getDate()}, ${firstDay.getFullYear()}`;
          }
        }
        return `${MONTHS[currentMonth]} ${currentYear}`;
      case 'day':
        if (dates.length > 0) {
          const day = dates[0];
          if (day) {
            return `${MONTHS[day.getMonth()]} ${day.getDate()}, ${day.getFullYear()}`;
          }
        }
        return `${MONTHS[currentMonth]} ${currentYear}`;
      default:
        return `${MONTHS[currentMonth]} ${currentYear}`;
    }
  };

  const viewTitle = getViewTitle();

  const handlePrevious = () => {
    switch (currentView) {
      case 'day':
        // Move to previous day
        {
          const prevDay = new Date(currentYear, currentMonth, currentDate);
          prevDay.setDate(prevDay.getDate() - 1);
          setCurrentYear(prevDay.getFullYear());
          setCurrentMonth(prevDay.getMonth());
          setCurrentDate(prevDay.getDate());
        }
        break;

      case 'week':
        // Move to previous week
        {
          const prevWeek = new Date(currentYear, currentMonth, currentDate);
          prevWeek.setDate(prevWeek.getDate() - 7);
          setCurrentYear(prevWeek.getFullYear());
          setCurrentMonth(prevWeek.getMonth());
          setCurrentDate(prevWeek.getDate());
        }
        break;

      case 'month':
      default:
        // Move to previous month
        if (currentMonth === 0) {
          setCurrentMonth(11);
          setCurrentYear(currentYear - 1);
        } else {
          setCurrentMonth(currentMonth - 1);
        }
        // Keep date at 15th for month view
        setCurrentDate(15);
        break;
    }
  };

  const handleNext = () => {
    switch (currentView) {
      case 'day':
        // Move to next day
        {
          const nextDay = new Date(currentYear, currentMonth, currentDate);
          nextDay.setDate(nextDay.getDate() + 1);
          setCurrentYear(nextDay.getFullYear());
          setCurrentMonth(nextDay.getMonth());
          setCurrentDate(nextDay.getDate());
        }
        break;

      case 'week':
        // Move to next week
        {
          const nextWeek = new Date(currentYear, currentMonth, currentDate);
          nextWeek.setDate(nextWeek.getDate() + 7);
          setCurrentYear(nextWeek.getFullYear());
          setCurrentMonth(nextWeek.getMonth());
          setCurrentDate(nextWeek.getDate());
        }
        break;

      case 'month':
      default:
        // Move to next month
        if (currentMonth === 11) {
          setCurrentMonth(0);
          setCurrentYear(currentYear + 1);
        } else {
          setCurrentMonth(currentMonth + 1);
        }
        // Keep date at 15th for month view
        setCurrentDate(15);
        break;
    }
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setCurrentDate(today.getDate());
  };

  return (
    <CalendarContainer>
      <CalendarHeader
        title={viewTitle}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
      />

      {!hideControls && (
        <>
          <CalendarSelector
            calendars={calendars}
            selectedCalendar={selectedCalendar}
            onCalendarChange={onCalendarChange}
            isLoading={isLoadingCalendars}
          />

          {onSearchChange && (
            <div className="mb-4 px-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={e => onSearchChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <svg
                  className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => onSearchChange('')}
                    className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 hover:text-gray-600"
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
              {searchQuery && (
                <div className="mt-2 text-sm text-gray-600">
                  Showing {filteredEvents.length} of {events.length} events
                </div>
              )}
            </div>
          )}
        </>
      )}

      <CalendarContent>
        {/* Month View - Traditional Grid */}
        {currentView === 'month' && (
          <>
            <WeekdayHeader weekdays={headers} className="mb-2" />
            <div className="relative h-full">
              {/* Day cells layer */}
              <ViewContainer view={currentView}>
                {dates.map(date => {
                  const key = dateKey(date);
                  const inCurrentMonth = date.getMonth() === currentMonth;
                  const dayEvents = singleDayBuckets.get(key) ?? [];

                  const isToday =
                    date.getFullYear() === now.getFullYear() &&
                    date.getMonth() === now.getMonth() &&
                    date.getDate() === now.getDate();

                  // Check if this date is in the past (before today)
                  const isPast =
                    date <
                    new Date(now.getFullYear(), now.getMonth(), now.getDate());

                  // Check if this date is a weekend (Saturday = 6, Sunday = 0)
                  const dayOfWeek = date.getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                  return (
                    <DayCell
                      key={key}
                      day={date.getDate()}
                      isToday={isToday}
                      isCurrentMonth={inCurrentMonth}
                      isPast={isPast}
                      isWeekend={isWeekend}
                      events={dayEvents}
                      maxEvents={maxEventsPerDay}
                      view={currentView}
                      onClick={() => onDayClick?.(key)}
                      {...(onEventClick && { onEventClick })}
                    />
                  );
                })}
              </ViewContainer>

              {/* Multi-day events overlay layer - same grid template */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="grid grid-cols-7 grid-rows-6 gap-px h-full w-full">
                  {/* Multi-day Event Overlays - positioned using CSS Grid with band stacking */}
                  {(() => {
                    // Calculate band assignments for multi-day events to prevent overlapping
                    const eventBands: Array<{
                      event: CalendarEvent;
                      startDate: Date;
                      endDate: Date;
                      band: number;
                    }> = [];

                    multiDayEvents.forEach(multiEvent => {
                      const { event, startDate, endDate } = multiEvent;

                      // Find the lowest available band for this event
                      let band = 0;
                      let bandAvailable = false;

                      while (!bandAvailable) {
                        // Check if this band conflicts with existing events
                        const conflicts = eventBands.filter(
                          existing =>
                            existing.band === band &&
                            // Check for date overlap
                            !(
                              endDate < existing.startDate ||
                              startDate > existing.endDate
                            )
                        );

                        if (conflicts.length === 0) {
                          bandAvailable = true;
                        } else {
                          band++;
                        }
                      }

                      eventBands.push({ event, startDate, endDate, band });
                    });

                    return eventBands.map(
                      ({ event, startDate, endDate, band }) => {
                        // Calculate grid position for spanning
                        const startIndex = dates.findIndex(
                          date => dateKey(date) === dateKey(startDate)
                        );
                        const endIndex = dates.findIndex(date => {
                          return dateKey(date) === dateKey(endDate);
                        });

                        if (startIndex === -1) return null; // Event starts outside visible range

                        const actualEndIndex =
                          endIndex === -1 ? dates.length - 1 : endIndex;
                        const startRow = Math.floor(startIndex / 7);
                        const endRow = Math.floor(actualEndIndex / 7);

                        // For events spanning multiple weeks, create separate bars for each week
                        const eventBars = [];
                        for (let row = startRow; row <= endRow; row++) {
                          const rowStartIndex = row * 7;
                          const rowEndIndex = Math.min(
                            rowStartIndex + 6,
                            dates.length - 1
                          );

                          const barStartIndex = Math.max(
                            startIndex,
                            rowStartIndex
                          );
                          const barEndIndex = Math.min(
                            actualEndIndex,
                            rowEndIndex
                          );

                          if (barStartIndex <= barEndIndex) {
                            const startCol = barStartIndex % 7;
                            const endCol = barEndIndex % 7;
                            const colSpan = endCol - startCol + 1;

                            eventBars.push(
                              <MultiDayEventBar
                                key={`${event.id}-row-${row}-band-${band}`}
                                event={event}
                                startCol={startCol}
                                colSpan={colSpan}
                                row={row}
                                band={band}
                                isFirstSegment={row === startRow}
                                onClick={onEventClick}
                              />
                            );
                          }
                        }

                        return eventBars;
                      }
                    );
                  })()}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Week and Day Views - Time-based Grid */}
        {(currentView === 'week' || currentView === 'day') && (
          <TimeGrid
            dates={dates}
            events={filteredEvents}
            view={currentView}
            {...(onEventClick && { onEventClick })}
            {...(onTimeSlotClick && { onTimeSlotClick })}
          />
        )}
      </CalendarContent>
    </CalendarContainer>
  );
};

export default Calendar;
