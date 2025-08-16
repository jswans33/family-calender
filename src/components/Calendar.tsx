import React, { useMemo, useState } from 'react';
import { CalendarContainer, CalendarContent } from './primitives/CalendarContainer';
import { CalendarHeader } from './primitives/CalendarHeader';
import { ViewContainer } from './primitives/ViewContainer';
import { WeekdayHeader } from './primitives/CalendarGrid';
import { DayCell, CalendarEvent, CalendarView } from './primitives/DayCell';
import { TimeGrid } from './primitives/TimeGrid';

interface CalendarProps {
  events: CalendarEvent[];
  year?: number;                  // default = now
  month?: number;                 // 0-11, default = now
  startOfWeek?: 0|1|2|3|4|5|6;    // 0=Sun, default=1
  maxEventsPerDay?: number;       // default=3
  view?: CalendarView;            // default = 'month'
  onDayClick?: (dateISO: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onTimeSlotClick?: (date: string, time: string) => void;
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
  onTimeSlotClick,
}) => {
  const [currentYear, setCurrentYear] = useState(year ?? new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(month ?? new Date().getMonth());
  const [currentDate, setCurrentDate] = useState(new Date().getDate()); // Track the specific date for day/week navigation
  const currentView = view; // Use the view prop directly

  const now = new Date();
  const headers = useMemo(() => rotatedDays(startOfWeek), [startOfWeek]);
  
  // Generate dates based on current view
  const dates = useMemo(() => {
    switch (currentView) {
      case 'month':
        return monthGridDates(currentYear, currentMonth, startOfWeek);
      case 'week':
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
      case 'day':
        // Show the specific current date
        return [new Date(currentYear, currentMonth, currentDate)];
      default:
        return monthGridDates(currentYear, currentMonth, startOfWeek);
    }
  }, [currentYear, currentMonth, currentDate, currentView, startOfWeek]);

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
          const lastDay = dates[6] || dates[0]; // Fallback to first day if no 6th day
          if (firstDay && lastDay && firstDay.getMonth() === lastDay.getMonth()) {
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
        const prevDay = new Date(currentYear, currentMonth, currentDate);
        prevDay.setDate(prevDay.getDate() - 1);
        setCurrentYear(prevDay.getFullYear());
        setCurrentMonth(prevDay.getMonth());
        setCurrentDate(prevDay.getDate());
        break;
      
      case 'week':
        // Move to previous week
        const prevWeek = new Date(currentYear, currentMonth, currentDate);
        prevWeek.setDate(prevWeek.getDate() - 7);
        setCurrentYear(prevWeek.getFullYear());
        setCurrentMonth(prevWeek.getMonth());
        setCurrentDate(prevWeek.getDate());
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
        const nextDay = new Date(currentYear, currentMonth, currentDate);
        nextDay.setDate(nextDay.getDate() + 1);
        setCurrentYear(nextDay.getFullYear());
        setCurrentMonth(nextDay.getMonth());
        setCurrentDate(nextDay.getDate());
        break;
      
      case 'week':
        // Move to next week
        const nextWeek = new Date(currentYear, currentMonth, currentDate);
        nextWeek.setDate(nextWeek.getDate() + 7);
        setCurrentYear(nextWeek.getFullYear());
        setCurrentMonth(nextWeek.getMonth());
        setCurrentDate(nextWeek.getDate());
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
      
      <CalendarContent>
        {/* Month View - Traditional Grid */}
        {currentView === 'month' && (
          <>
            <WeekdayHeader weekdays={headers} className="mb-2" />
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
          </>
        )}

        {/* Week and Day Views - Time-based Grid */}
        {(currentView === 'week' || currentView === 'day') && (
          <TimeGrid
            dates={dates}
            events={events}
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