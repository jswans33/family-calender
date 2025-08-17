import React, { useState, useEffect, useMemo } from 'react';
import Calendar from './components/Calendar';
import CalendarService from './services/CalendarService';
import { CalendarEvent, CalendarView } from './types/shared';
import { EventModal } from './components/primitives/EventModal';
import { ColorProvider } from './contexts/ColorContext';
import EventAccordion from './components/primitives/EventAccordion';
import VacationPanel from './components/VacationPanel';
import './App.css';

const App: React.FC = () => {
  // State to store calendar events fetched from Apple Calendar
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  // Loading state to show spinner while fetching events
  const [loading, setLoading] = useState<boolean>(true);
  // Multi-calendar state
  const [calendars, setCalendars] = useState<
    Array<{ name: string; count: number }>
  >([]);
  const [selectedCalendar, setSelectedCalendar] = useState<string | null>(null);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState<boolean>(true);
  // Selected event for details panel
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );
  // Current calendar view
  const [currentView, setCurrentView] = useState<CalendarView>('month');
  // Selected date for day view
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // Event creation modal state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventModalData, setEventModalData] = useState<{
    date: string;
    time?: string;
    event?: CalendarEvent;
  } | null>(null);
  // Search functionality
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Load calendars on mount
  useEffect(() => {
    const loadCalendars = async (): Promise<void> => {
      setIsLoadingCalendars(true);
      const calendarService = new CalendarService();
      try {
        const fetchedCalendars = await calendarService.fetchCalendars();
        setCalendars(fetchedCalendars);
      } catch (error) {
        console.error('Failed to load calendars:', error);
      }
      setIsLoadingCalendars(false);
    };

    loadCalendars();
  }, []);

  // Load events when calendar selection changes
  useEffect(() => {
    const loadEvents = async (): Promise<void> => {
      setLoading(true);
      // Initialize calendar service for API communication
      const calendarService = new CalendarService();
      // Connect to Apple Calendar via CalDAV
      await calendarService.connectToAppleCalendar();
      // Fetch events from selected calendar or all calendars
      const fetchedEvents = await calendarService.fetchEvents(
        selectedCalendar || undefined
      );
      // Update state with fetched events
      setEvents(fetchedEvents);
      setLoading(false);
    };

    loadEvents();
  }, [selectedCalendar]); // Reload when calendar selection changes

  // Handle event creation
  const handleCreateEvent = async (
    newEvent: Partial<CalendarEvent> & { calendar_name?: string }
  ) => {
    try {
      const calendarService = new CalendarService();
      const success = await calendarService.createEvent(newEvent);

      if (success) {
        // Add to local state
        setEvents(prevEvents => [...prevEvents, newEvent as CalendarEvent]);
        console.log('Event created successfully:', newEvent);

        // Reload events to get fresh data from server
        const fetchedEvents = await calendarService.fetchEvents(
          selectedCalendar || undefined
        );
        setEvents(fetchedEvents);

        // Reload calendars to update counts
        const fetchedCalendars = await calendarService.fetchCalendars();
        setCalendars(fetchedCalendars);
      } else {
        alert('Failed to create event');
      }
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Error creating event');
    }
  };

  // Handle event editing
  const handleEditEvent = (event: CalendarEvent | null) => {
    if (!event) return;

    setEventModalData({
      date: event.date,
      time: event.time || '',
      event: event, // Pass the full event for editing
    });
    setIsEventModalOpen(true);
  };

  // Handle event deletion
  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;

    try {
      const calendarService = new CalendarService();
      const success = await calendarService.deleteEvent(eventId);

      if (success) {
        // Remove from local state
        setEvents(prevEvents =>
          prevEvents.filter(event => event.id !== eventId)
        );

        // Clear selected event if it was deleted
        if (selectedEvent && selectedEvent.id === eventId) {
          setSelectedEvent(null);
        }

        console.log('Event deleted successfully');
      } else {
        alert('Failed to delete event');
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Error deleting event');
    }
  };

  // Handle calendar selection change
  const handleCalendarChange = (calendar: string | null) => {
    setSelectedCalendar(calendar);
  };

  // Handle manual sync
  const handleSync = async () => {
    try {
      console.log('Starting manual sync...');
      const calendarService = new CalendarService();
      const success = await calendarService.syncCalendar();

      if (success) {
        console.log('Sync completed successfully');
        // Reload events after sync
        setLoading(true);
        const fetchedEvents = await calendarService.fetchEvents(
          selectedCalendar || undefined
        );
        setEvents(fetchedEvents);
        setLoading(false);
        // Reload calendars to update counts
        const fetchedCalendars = await calendarService.fetchCalendars();
        setCalendars(fetchedCalendars);
        alert('Calendar synced successfully!');
      } else {
        alert('Failed to sync calendar');
      }
    } catch (error) {
      console.error('Error syncing calendar:', error);
      alert('Error syncing calendar');
    }
  };

  // Handle event update
  const handleUpdateEvent = async (updatedEvent: Partial<CalendarEvent>) => {
    if (!updatedEvent.id) return;

    try {
      const calendarService = new CalendarService();
      const success = await calendarService.updateEvent(
        updatedEvent as CalendarEvent
      );

      if (success) {
        // Update local state
        setEvents(prevEvents =>
          prevEvents.map(event =>
            event.id === updatedEvent.id ? { ...event, ...updatedEvent } : event
          )
        );

        // Update selected event if it's the one being edited
        if (selectedEvent && selectedEvent.id === updatedEvent.id) {
          setSelectedEvent({
            ...selectedEvent,
            ...updatedEvent,
          } as CalendarEvent);
        }

        console.log('Event updated successfully:', updatedEvent);
      } else {
        console.error('Failed to update event');
      }
    } catch (error) {
      console.error('Error updating event:', error);
    }
  };

  // Handle time slot click for event creation
  const handleTimeSlotClick = (date: string, time?: string) => {
    setEventModalData({ date, time: time || '' });
    setIsEventModalOpen(true);
  };

  // Filter upcoming events and group by calendar - moved before early return to avoid hook order issues
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format

  const upcomingEventGroups = useMemo(() => {
    const upcomingEvents = events
      .filter(event => event.date >= (todayStr || ''))
      .sort((a, b) => {
        // Sort by date first, then by time
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }
        if (a.time && b.time) {
          return a.time.localeCompare(b.time);
        }
        return a.time ? -1 : 1; // Events with time come before all-day events
      });

    // Group events by calendar
    const groups = new Map<string, CalendarEvent[]>();

    upcomingEvents.forEach(event => {
      const calendarName = event.calendar_name || 'home';
      if (!groups.has(calendarName)) {
        groups.set(calendarName, []);
      }
      groups.get(calendarName)!.push(event);
    });

    // Convert to array and limit events per calendar
    return Array.from(groups.entries()).map(([calendarName, events]) => ({
      calendarName,
      events: events.slice(0, 6), // Limit to 6 events per calendar
    }));
  }, [events, todayStr]);

  // Show loading spinner while events are being fetched
  if (loading) {
    return <div className="loading">Loading calendar...</div>;
  }

  return (
    <ColorProvider>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              Family Calendar
            </h1>

            <div className="flex items-center gap-6">
              {/* View Switcher */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">View:</span>
                {(['month', 'week', 'day'] as CalendarView[]).map(view => (
                  <button
                    key={view}
                    onClick={() => setCurrentView(view)}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      currentView === view
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {view.charAt(0).toUpperCase() + view.slice(1)}
                  </button>
                ))}
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const today =
                      new Date().toISOString().split('T')[0] ||
                      new Date().toISOString();
                    handleTimeSlotClick(today, '');
                  }}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Add Event
                </button>
                <button
                  onClick={handleSync}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  🔄 Sync
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex">
          {/* Left Panel - Event Details & Vacation */}
          <div className="w-1/4 bg-white border-r border-gray-200 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Event Details
              </h3>
              {selectedEvent && (
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close details"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
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

            {selectedEvent ? (
              <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">
                <div>
                  <h4 className="font-semibold text-gray-900 text-lg mb-3">
                    {selectedEvent.title}
                  </h4>

                  {/* Basic Info */}
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center text-gray-600">
                      <svg
                        className="w-4 h-4 mr-2 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <span>
                        {new Date(selectedEvent.date).toLocaleDateString(
                          'en-US',
                          {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          }
                        )}
                      </span>
                    </div>

                    <div className="flex items-center text-gray-600">
                      <svg
                        className="w-4 h-4 mr-2 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>
                        {selectedEvent.time || 'All day'}
                        {selectedEvent.dtend && selectedEvent.time && (
                          <span className="text-gray-500">
                            {' '}
                            -{' '}
                            {new Date(selectedEvent.dtend).toLocaleTimeString(
                              'en-US',
                              {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                              }
                            )}
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Location */}
                    {selectedEvent.location && (
                      <div className="flex items-start text-gray-600">
                        <svg
                          className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span>{selectedEvent.location}</span>
                      </div>
                    )}

                    {/* Description */}
                    {selectedEvent.description && (
                      <div className="flex items-start text-gray-600">
                        <svg
                          className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 6h16M4 12h16M4 18h7"
                          />
                        </svg>
                        <span className="text-xs leading-relaxed">
                          {selectedEvent.description}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditEvent(selectedEvent)}
                      className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Edit Event
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(selectedEvent.id)}
                      className="flex-1 px-3 py-2 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 text-sm">
                <svg
                  className="w-12 h-12 mx-auto mb-3 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p>Click on an event to view details</p>
              </div>
            )}

            {/* Vacation Panel - Bottom Left */}
            <div className="mt-4">
              <VacationPanel />
            </div>
          </div>

          {/* Center Panel - Calendar */}
          <div className="flex-1 p-4">
            <Calendar
              events={events}
              calendars={calendars}
              selectedCalendar={selectedCalendar}
              onCalendarChange={handleCalendarChange}
              isLoadingCalendars={isLoadingCalendars}
              view={currentView}
              selectedDate={selectedDate}
              onEventClick={setSelectedEvent}
              onDayClick={dateStr => {
                // Set the selected date and switch to day view
                setSelectedDate(dateStr);
                setCurrentView('day');
              }}
              onTimeSlotClick={handleTimeSlotClick}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </div>

          {/* Right Panel - Upcoming Events Accordion */}
          <div className="w-1/4 bg-white border-l border-gray-200 p-4 overflow-y-auto">
            <EventAccordion
              eventGroups={upcomingEventGroups}
              selectedEvent={selectedEvent}
              onEventClick={setSelectedEvent}
            />
          </div>
        </div>

        {/* Event Creation/Edit Modal */}
        <EventModal
          isOpen={isEventModalOpen}
          onClose={() => setIsEventModalOpen(false)}
          onSave={eventModalData?.event ? handleUpdateEvent : handleCreateEvent}
          initialData={eventModalData || undefined}
          isEditing={!!eventModalData?.event}
          selectedCalendar={selectedCalendar || 'home'}
        />
      </div>
    </ColorProvider>
  );
};

export default App;
