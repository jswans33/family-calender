import React, { useState, useEffect } from 'react';
import Calendar from './components/Calendar';
import CalendarService from './services/CalendarService';
import { CalendarEvent, CalendarView } from './components/primitives/DayCell';
import { EventModal } from './components/primitives/EventModal';
import './App.css';

const App: React.FC = () => {
  // State to store calendar events fetched from Apple Calendar
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  // Loading state to show spinner while fetching events
  const [loading, setLoading] = useState<boolean>(true);
  // Selected event for details panel
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  // Current calendar view
  const [currentView, setCurrentView] = useState<CalendarView>('month');
  // Selected date for day view
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // Event creation modal state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventModalData, setEventModalData] = useState<{date: string; time?: string; event?: CalendarEvent} | null>(null);

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

  // Handle event creation
  const handleCreateEvent = (newEvent: Partial<CalendarEvent>) => {
    // Add to local state immediately (optimistic update)
    setEvents(prevEvents => [...prevEvents, newEvent as CalendarEvent]);
    
    // TODO: Send to backend/CalDAV service
    console.log('Creating event:', newEvent);
  };

  // Handle event editing
  const handleEditEvent = (event: CalendarEvent | null) => {
    if (!event) return;
    
    setEventModalData({ 
      date: event.date, 
      time: event.time,
      event: event // Pass the full event for editing
    });
    setIsEventModalOpen(true);
  };

  // Handle event update
  const handleUpdateEvent = async (updatedEvent: Partial<CalendarEvent>) => {
    if (!updatedEvent.id) return;
    
    try {
      const calendarService = new CalendarService();
      const success = await calendarService.updateEvent(updatedEvent as CalendarEvent);
      
      if (success) {
        // Update local state
        setEvents(prevEvents => 
          prevEvents.map(event => 
            event.id === updatedEvent.id ? { ...event, ...updatedEvent } : event
          )
        );
        
        // Update selected event if it's the one being edited
        if (selectedEvent && selectedEvent.id === updatedEvent.id) {
          setSelectedEvent({ ...selectedEvent, ...updatedEvent } as CalendarEvent);
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
    setEventModalData({ date, time });
    setIsEventModalOpen(true);
  };

  // Show loading spinner while events are being fetched
  if (loading) {
    return <div className="loading">Loading calendar...</div>;
  }

  // Filter upcoming events (today and future)
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
  
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
    })
    .slice(0, 8); // Show next 8 events

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Panel - 20% */}
      <div className="w-1/5 bg-white border-r border-gray-200 p-4 space-y-6">
        {/* View Switcher */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Calendar View</h2>
          <div className="space-y-2">
            {(['month', 'week', 'day'] as CalendarView[]).map((view) => (
              <button 
                key={view}
                onClick={() => setCurrentView(view)}
                className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                  currentView === view 
                    ? 'bg-blue-100 text-blue-700 font-medium' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {view.charAt(0).toUpperCase() + view.slice(1)} View
              </button>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <button 
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                handleTimeSlotClick(today);
              }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              Add Event
            </button>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">
              Today's Events
            </button>
          </div>
        </div>

        {/* Calendar Info */}
        <div>
          <h3 className="text-md font-medium text-gray-900 mb-3">Calendar Stats</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <div>Total Events: {events.length}</div>
            <div>Upcoming: {upcomingEvents.length}</div>
          </div>
        </div>
      </div>

      {/* Center Panel - 60% */}
      <div className="w-3/5 flex flex-col">
        <div className="p-4 bg-white border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Family Calendar</h1>
        </div>
        <div className="flex-1 p-4">
          <Calendar 
            events={events} 
            view={currentView}
            onEventClick={setSelectedEvent}
            onDayClick={(dateStr) => {
              // Set the selected date and switch to day view
              setSelectedDate(dateStr);
              setCurrentView('day');
            }}
            onTimeSlotClick={handleTimeSlotClick}
          />
        </div>
      </div>

      {/* Right Panel - 20% */}
      <div className="w-1/5 bg-white border-l border-gray-200 flex flex-col h-screen">
        {/* Top Section - Upcoming Events */}
        <div className="flex-1 p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Events</h2>
          <div className="space-y-3 overflow-y-auto max-h-[calc(50vh-100px)]">
            {upcomingEvents.map((event) => {
              const eventDate = new Date(event.date);
              const isToday = event.date === todayStr;
              const daysDiff = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              const isSelected = selectedEvent?.id === event.id;
              
              return (
                <div 
                  key={event.id} 
                  className={`p-3 rounded-lg text-sm border-l-4 cursor-pointer transition-colors ${
                    isSelected 
                      ? 'bg-blue-100 border-blue-600' 
                      : 'bg-blue-50 border-blue-400 hover:bg-blue-100'
                  }`}
                  onClick={() => setSelectedEvent(event)}
                >
                  <div className="font-medium text-blue-900 mb-1">{event.title}</div>
                  <div className="text-blue-700 text-xs space-y-1">
                    <div className="font-medium">
                      {isToday ? 'Today' : daysDiff === 1 ? 'Tomorrow' : eventDate.toLocaleDateString()}
                    </div>
                    <div>{event.time || 'All day'}</div>
                  </div>
                </div>
              );
            })}
            {upcomingEvents.length === 0 && (
              <div className="text-gray-500 text-sm italic">No upcoming events</div>
            )}
          </div>
        </div>

        {/* Bottom Section - Event Details */}
        <div className="flex-none h-1/2 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Event Details</h3>
            {selectedEvent && (
              <button 
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close details"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          {selectedEvent ? (
          <div className="space-y-4 overflow-y-auto max-h-[calc(50vh-120px)]">
            <div>
              <h4 className="font-semibold text-gray-900 text-lg mb-3">{selectedEvent.title}</h4>
              
              {/* Basic Info */}
              <div className="space-y-3 text-sm">
                <div className="flex items-center text-gray-600">
                  <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{new Date(selectedEvent.date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</span>
                </div>
                
                <div className="flex items-center text-gray-600">
                  <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    {selectedEvent.time || 'All day'}
                    {selectedEvent.dtend && selectedEvent.time && (
                      <span className="text-gray-500"> - {new Date(selectedEvent.dtend).toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit',
                        hour12: true 
                      })}</span>
                    )}
                  </span>
                </div>

                {/* Location */}
                {selectedEvent.location && (
                  <div className="flex items-start text-gray-600">
                    <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{selectedEvent.location}</span>
                  </div>
                )}

                {/* Description */}
                {selectedEvent.description && (
                  <div className="flex items-start text-gray-600">
                    <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                    <span className="text-xs leading-relaxed">{selectedEvent.description}</span>
                  </div>
                )}

                {/* Meeting Link */}
                {selectedEvent.url && (
                  <div className="flex items-center text-gray-600">
                    <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <a 
                      href={selectedEvent.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      Join Meeting
                    </a>
                  </div>
                )}

                {/* Attendees */}
                {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                  <div className="flex items-start text-gray-600">
                    <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                    <div>
                      <div className="font-medium mb-1">Attendees ({selectedEvent.attendees.length})</div>
                      <div className="space-y-1">
                        {selectedEvent.attendees.slice(0, 3).map((attendee, i) => (
                          <div key={i} className="text-xs text-gray-500">{attendee}</div>
                        ))}
                        {selectedEvent.attendees.length > 3 && (
                          <div className="text-xs text-gray-400">+{selectedEvent.attendees.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Categories/Tags */}
                {selectedEvent.categories && selectedEvent.categories.length > 0 && (
                  <div className="flex items-start text-gray-600">
                    <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <div className="flex flex-wrap gap-1">
                      {selectedEvent.categories.map((category, i) => (
                        <span key={i} className="inline-block px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded">
                          {category}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status & Priority */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  {selectedEvent.status && (
                    <span className={`px-2 py-1 rounded ${
                      selectedEvent.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                      selectedEvent.status === 'TENTATIVE' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {selectedEvent.status}
                    </span>
                  )}
                  {selectedEvent.priority && selectedEvent.priority > 5 && (
                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
                      High Priority
                    </span>
                  )}
                </div>
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
                <button className="flex-1 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          </div>
          ) : (
            <div className="text-center text-gray-500 text-sm">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>Click on an event to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Event Creation/Edit Modal */}
      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        onSave={eventModalData?.event ? handleUpdateEvent : handleCreateEvent}
        initialData={eventModalData || undefined}
        isEditing={!!eventModalData?.event}
      />
    </div>
  );
};

export default App;