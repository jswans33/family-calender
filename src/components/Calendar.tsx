import React from 'react';

// Type definition for calendar events
interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
}

// Props interface for Calendar component
interface CalendarProps {
  events: CalendarEvent[];
}

/**
 * Calendar component - Renders a month view calendar with events
 * Displays current month with events from Apple Calendar
 * @param events Array of calendar events to display
 */
const Calendar: React.FC<CalendarProps> = ({ events }) => {
  // Get current date information for calendar display
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  // Calculate calendar layout values
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  
  // Month names for header display
  const monthNames: string[] = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  // Array to hold all calendar day elements
  const days: React.ReactElement[] = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
  }
  
  // Generate calendar days with events
  for (let day = 1; day <= daysInMonth; day++) {
    // Filter events for this specific day
    const dayEvents = events.filter((event: CalendarEvent) => {
      const eventDate = new Date(event.date);
      return eventDate.getDate() === day && 
             eventDate.getMonth() === currentMonth && 
             eventDate.getFullYear() === currentYear;
    });
    
    // Create calendar day element with events
    days.push(
      <div key={day} className="calendar-day">
        <div className="day-number">{day}</div>
        {dayEvents.map((event: CalendarEvent, index: number) => (
          <div key={index} className="event">{event.title}</div>
        ))}
      </div>
    );
  }
  
  return (
    <div className="calendar">
      {/* Calendar header with month and year */}
      <h2>{monthNames[currentMonth]} {currentYear}</h2>
      <div className="calendar-grid">
        {/* Day of week headers */}
        <div className="day-header">Sun</div>
        <div className="day-header">Mon</div>
        <div className="day-header">Tue</div>
        <div className="day-header">Wed</div>
        <div className="day-header">Thu</div>
        <div className="day-header">Fri</div>
        <div className="day-header">Sat</div>
        {/* Calendar days with events */}
        {days}
      </div>
    </div>
  );
};

export default Calendar;