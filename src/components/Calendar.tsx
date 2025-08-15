import React, { useMemo, useState } from 'react';
import { CalendarContainer, CalendarContent } from './primitives/CalendarContainer';
import { CalendarHeader } from './primitives/CalendarHeader';
import { ViewContainer } from './primitives/ViewContainer';
import { WeekdayHeader } from './primitives/CalendarGrid';
import { DayCell, CalendarEvent, CalendarView } from './primitives/DayCell';

interface CalendarProps {
  events: CalendarEvent[];
  year?: number;                  // default = now
  month?: number;                 // 0-11, default = now
  startOfWeek?: 0|1|2|3|4|5|6;    // 0=Sun, default=1
  maxEventsPerDay?: number;       // default=3
  view?: CalendarView;            // default = 'month'
  onDayClick?: (dateISO: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const dateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

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

function monthGridDates(year: number, month: number, startOfWeek: number): Date[] {
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
  year,
  month,
  startOfWeek = 1,
  maxEventsPerDay = 3,
  view = 'month',
  onDayClick,
  onEventClick,
}) => {
  const [currentYear, setCurrentYear] = useState(year ?? new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(month ?? new Date().getMonth());
  const currentView = view; // Use the view prop directly

  const now = new Date();
  const headers = useMemo(() => rotatedDays(startOfWeek), [startOfWeek]);
  
  // Generate dates based on current view
  const dates = useMemo(() => {
    switch (currentView) {
      case 'month':
        return monthGridDates(currentYear, currentMonth, startOfWeek);
      case 'week':
        // Get the week containing the 15th of the current month (middle of month)
        const midMonth = new Date(currentYear, currentMonth, 15);
        const weekStart = new Date(midMonth);
        const dayOfWeek = midMonth.getDay();
        const daysFromStart = (dayOfWeek - startOfWeek + 7) % 7;
        weekStart.setDate(midMonth.getDate() - daysFromStart);
        
        const weekDates = [];
        for (let i = 0; i < 7; i++) {
          const date = new Date(weekStart);
          date.setDate(weekStart.getDate() + i);
          weekDates.push(date);
        }
        return weekDates;
      case 'day':
        // Show today or the 15th of the current month if navigating through months
        const dayDate = new Date();
        if (currentYear !== dayDate.getFullYear() || currentMonth !== dayDate.getMonth()) {
          // If viewing a different month/year, show the 15th of that month
          return [new Date(currentYear, currentMonth, 15)];
        }
        return [dayDate];
      default:
        return monthGridDates(currentYear, currentMonth, startOfWeek);
    }
  }, [currentYear, currentMonth, currentView, startOfWeek]);

  // Event bucketing
  const buckets = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const k = dateKey(parseLocal(e.date, e.time || undefined));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => minutesFromTime(a.time) - minutesFromTime(b.time));
    }
    return map;
  }, [events]);

  // Generate appropriate title based on view
  const getViewTitle = () => {
    switch (currentView) {
      case 'month':
        return `${MONTHS[currentMonth]} ${currentYear}`;
      case 'week':
        if (dates.length > 0) {
          const firstDay = dates[0];
          const lastDay = dates[6];
          if (firstDay.getMonth() === lastDay.getMonth()) {
            return `${MONTHS[firstDay.getMonth()]} ${firstDay.getDate()}-${lastDay.getDate()}, ${firstDay.getFullYear()}`;
          } else {
            return `${MONTHS[firstDay.getMonth()]} ${firstDay.getDate()} - ${MONTHS[lastDay.getMonth()]} ${lastDay.getDate()}, ${firstDay.getFullYear()}`;
          }
        }
        return `${MONTHS[currentMonth]} ${currentYear}`;
      case 'day':
        if (dates.length > 0) {
          const day = dates[0];
          return `${MONTHS[day.getMonth()]} ${day.getDate()}, ${day.getFullYear()}`;
        }
        return `${MONTHS[currentMonth]} ${currentYear}`;
      default:
        return `${MONTHS[currentMonth]} ${currentYear}`;
    }
  };

  const viewTitle = getViewTitle();

  const handlePrevious = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNext = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  return (
    <CalendarContainer>
      <CalendarHeader
        title={viewTitle}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
      />
      
      <CalendarContent>
        {/* Show weekday headers for month and week views */}
        {(currentView === 'month' || currentView === 'week') && (
          <WeekdayHeader weekdays={headers} className="mb-2" />
        )}
        
        <ViewContainer view={currentView}>
          {dates.map((date) => {
            const key = dateKey(date);
            const inCurrentMonth = date.getMonth() === currentMonth;
            const dayEvents = buckets.get(key) ?? [];
            const isToday =
              date.getFullYear() === now.getFullYear() &&
              date.getMonth() === now.getMonth() &&
              date.getDate() === now.getDate();
            
            // Check if this date is in the past (before today)
            const isPast = date < new Date(now.getFullYear(), now.getMonth(), now.getDate());

            return (
              <DayCell
                key={key}
                day={date.getDate()}
                isToday={isToday}
                isCurrentMonth={inCurrentMonth}
                isPast={isPast}
                events={dayEvents}
                maxEvents={maxEventsPerDay}
                view={currentView}
                onClick={() => onDayClick?.(key)}
                {...(onEventClick && { onEventClick })}
              />
            );
          })}
        </ViewContainer>
      </CalendarContent>
    </CalendarContainer>
  );
};

export default Calendar;