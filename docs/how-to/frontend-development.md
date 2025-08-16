# Frontend Integration Guide

## 📊 Event Data Structure

Yes! Each event has both **start** and **end** data:

```typescript
interface CalendarEvent {
  // Basic timing
  date: string; // Start date: "2025-08-15T09:00:00.000Z"
  time: string; // Formatted start: "09:00 AM"
  dtend?: string; // End date: "2025-08-15T10:00:00.000Z"
  duration?: string; // Duration: "PT1H0M" (1 hour)

  // Core info
  id: string;
  title: string;
  description?: string;
  location?: string;

  // Rich data
  organizer?: string;
  attendees?: string[];
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
  // ... 20+ other fields
}
```

## 🎯 How Frontend Should Use This API

### 1. Calendar Month View

```typescript
// Get all events for a month
const fetchMonthEvents = async (year: number, month: number) => {
  const startDate = new Date(year, month, 1).toISOString().split('T')[0];
  const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

  const response = await fetch(`/events?start=${startDate}&end=${endDate}`);
  return await response.json();
};

// Usage in React
const [events, setEvents] = useState([]);

useEffect(() => {
  fetchMonthEvents(2025, 7).then(setEvents); // August 2025
}, []);
```

### 2. Calendar Grid Component

```typescript
const CalendarGrid = ({ events }) => {
  // Group events by date
  const eventsByDate = events.reduce((acc, event) => {
    const dateKey = event.date.split('T')[0]; // "2025-08-15"
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {});

  return (
    <div className="calendar-grid">
      {/* Calendar days */}
      {Array.from({length: 31}, (_, i) => {
        const day = i + 1;
        const dateKey = `2025-08-${day.toString().padStart(2, '0')}`;
        const dayEvents = eventsByDate[dateKey] || [];

        return (
          <div key={day} className="calendar-day">
            <div className="day-number">{day}</div>
            {dayEvents.map(event => (
              <EventBubble key={event.id} event={event} />
            ))}
          </div>
        );
      })}
    </div>
  );
};
```

### 3. Event Display Component

```typescript
const EventBubble = ({ event }) => {
  // Calculate event duration for display
  const getEventDuration = () => {
    if (event.dtend) {
      const start = new Date(event.date);
      const end = new Date(event.dtend);
      const hours = Math.round((end - start) / (1000 * 60 * 60));
      return hours > 0 ? `${hours}h` : '30m';
    }
    return event.duration || '1h'; // Fallback
  };

  // Determine if event is all-day
  const isAllDay = event.time === 'All Day' ||
    (event.dtend && new Date(event.dtend).getDate() !== new Date(event.date).getDate());

  return (
    <div className={`event-bubble ${event.status?.toLowerCase()}`}>
      <div className="event-time">
        {isAllDay ? 'All Day' : event.time}
      </div>
      <div className="event-title">{event.title}</div>
      {event.location && (
        <div className="event-location">📍 {event.location}</div>
      )}
      <div className="event-duration">{getEventDuration()}</div>
    </div>
  );
};
```

### 4. Today's Events Sidebar

```typescript
const TodaysSidebar = () => {
  const [todaysEvents, setTodaysEvents] = useState([]);

  useEffect(() => {
    fetch('/events/today')
      .then(res => res.json())
      .then(setTodaysEvents);
  }, []);

  return (
    <div className="todays-events">
      <h3>Today's Events ({todaysEvents.length})</h3>
      {todaysEvents.map(event => (
        <div key={event.id} className="today-event">
          <div className="event-time">{event.time}</div>
          <div>
            <div className="event-title">{event.title}</div>
            {event.location && (
              <div className="event-location">📍 {event.location}</div>
            )}
            {event.attendees && (
              <div className="event-attendees">
                👥 {event.attendees.length} attendees
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
```

### 5. Event Detail Modal

```typescript
const EventDetailModal = ({ event, onClose }) => {
  const formatDateTime = (dateStr) => {
    return new Date(dateStr).toLocaleString();
  };

  const getEventStatus = () => {
    switch(event.status) {
      case 'CONFIRMED': return '✅ Confirmed';
      case 'TENTATIVE': return '❓ Tentative';
      case 'CANCELLED': return '❌ Cancelled';
      default: return '';
    }
  };

  return (
    <div className="event-modal">
      <div className="modal-header">
        <h2>{event.title}</h2>
        <button onClick={onClose}>×</button>
      </div>

      <div className="modal-body">
        {/* Time */}
        <div className="event-field">
          <strong>When:</strong>
          <div>{formatDateTime(event.date)}</div>
          {event.dtend && (
            <div>Until: {formatDateTime(event.dtend)}</div>
          )}
        </div>

        {/* Location */}
        {event.location && (
          <div className="event-field">
            <strong>Where:</strong>
            <div>📍 {event.location}</div>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <div className="event-field">
            <strong>Description:</strong>
            <div>{event.description}</div>
          </div>
        )}

        {/* Attendees */}
        {event.attendees && event.attendees.length > 0 && (
          <div className="event-field">
            <strong>Attendees ({event.attendees.length}):</strong>
            <ul>
              {event.attendees.map(email => (
                <li key={email}>{email}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Status */}
        {event.status && (
          <div className="event-field">
            <strong>Status:</strong>
            <div>{getEventStatus()}</div>
          </div>
        )}

        {/* Recurrence */}
        {event.rrule && (
          <div className="event-field">
            <strong>Repeats:</strong>
            <div>🔄 {event.rrule}</div>
          </div>
        )}

        {/* Links */}
        {event.url && (
          <div className="event-field">
            <strong>Link:</strong>
            <a href={event.url} target="_blank">🔗 Open</a>
          </div>
        )}

        {/* Attachments */}
        {event.attachments && event.attachments.length > 0 && (
          <div className="event-field">
            <strong>Attachments:</strong>
            {event.attachments.map((url, i) => (
              <a key={i} href={url} target="_blank">📎 Attachment {i + 1}</a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
```

## 🚀 API Usage Patterns

### Efficient Data Loading

```typescript
// Load different time ranges efficiently
const useCalendarData = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load month data when date changes
  useEffect(() => {
    const loadMonthData = async () => {
      setLoading(true);

      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

      try {
        const response = await fetch(
          `/events?start=${startDate}&end=${endDate}`
        );
        const monthEvents = await response.json();
        setEvents(monthEvents);
      } catch (error) {
        console.error('Failed to load events:', error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    loadMonthData();
  }, [currentDate]);

  return { events, loading, currentDate, setCurrentDate };
};
```

### Smart Event Filtering

```typescript
// Filter events by various criteria
const useEventFilters = events => {
  const [filters, setFilters] = useState({
    status: 'all',
    hasAttendees: false,
    category: null,
  });

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // Status filter
      if (filters.status !== 'all' && event.status !== filters.status) {
        return false;
      }

      // Attendees filter
      if (
        filters.hasAttendees &&
        (!event.attendees || event.attendees.length === 0)
      ) {
        return false;
      }

      // Category filter
      if (
        filters.category &&
        (!event.categories || !event.categories.includes(filters.category))
      ) {
        return false;
      }

      return true;
    });
  }, [events, filters]);

  return { filteredEvents, filters, setFilters };
};
```

## 📱 Mobile-Responsive Design

```css
/* Event bubbles that work on mobile */
.event-bubble {
  padding: 4px 6px;
  margin: 2px 0;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  background: #e3f2fd;
  border-left: 3px solid #2196f3;
}

.event-bubble.confirmed {
  background: #e8f5e8;
  border-left-color: #4caf50;
}

.event-bubble.tentative {
  background: #fff3e0;
  border-left-color: #ff9800;
}

.event-bubble.cancelled {
  background: #ffebee;
  border-left-color: #f44336;
  opacity: 0.7;
  text-decoration: line-through;
}

/* Responsive calendar grid */
@media (max-width: 768px) {
  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
  }

  .calendar-day {
    min-height: 80px;
    padding: 4px;
  }

  .event-bubble {
    font-size: 10px;
    padding: 2px 4px;
  }
}
```

## 🎯 Key Takeaways for Frontend

1. **Use Date Ranges**: Always request specific date ranges for better performance
2. **Event Duration**: Calculate using `date` and `dtend` fields
3. **Rich Display**: Leverage 20+ fields for detailed event information
4. **Status Handling**: Use `status` field for visual indicators
5. **Mobile First**: Design for small screens with collapsible event details
6. **Error Handling**: Always handle empty responses gracefully
7. **Real-time Updates**: Refresh data when user navigates between months

The API provides everything needed for a rich calendar experience - just fetch the data and display it smart!
