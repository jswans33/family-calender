import React, { useState, useEffect } from 'react';
import Calendar from './components/Calendar';
import CalendarService from './services/CalendarService';
import './App.css';

// Type definition for calendar events
interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
}

const App: React.FC = () => {
  // State to store calendar events fetched from Apple Calendar
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  // Loading state to show spinner while fetching events
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadEvents = async (): Promise<void> => {
      setLoading(true);
      // Initialize calendar service for API communication
      const calendarService = new CalendarService();
      // Connect to Apple Calendar via CalDAV
      await calendarService.connectToAppleCalendar();
      // Fetch all events from the server endpoint
      const fetchedEvents = await calendarService.fetchEvents();
      // Update state with fetched events
      setEvents(fetchedEvents);
      setLoading(false);
    };

    loadEvents();
  }, []); // Empty dependency array - only run on component mount

  // Show loading spinner while events are being fetched
  if (loading) {
    return <div className="loading">Loading calendar...</div>;
  }

  return (
    <div className="App">
      <h1>Simple Calendar</h1>
      {/* Pass events to calendar component for rendering */}
      <Calendar events={events} />
    </div>
  );
};

export default App;