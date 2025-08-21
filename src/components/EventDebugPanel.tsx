import React, { useState, useEffect } from 'react';
import { CalendarEvent } from '../types/shared';
import { DateUtils } from '../utils/dateUtils';
import CalendarService from '../services/CalendarService';

export const EventDebugPanel: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, upcoming, past, today
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      const calendarService = new CalendarService();
      const data = await calendarService.fetchEvents();
      setEvents(data);
      setLoading(false);
    };
    fetchEvents();
  }, []);

  const filteredEvents = events.filter(event => {
    // Apply date filter
    const debugInfo = DateUtils.getDebugInfo(event);

    if (filter === 'upcoming' && !debugInfo.isFuture) return false;
    if (filter === 'past' && debugInfo.isFuture) return false;
    if (filter === 'today' && !DateUtils.isToday(event.date || event.start))
      return false;

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        event.title?.toLowerCase().includes(search) ||
        event.calendar_name?.toLowerCase().includes(search) ||
        event.id?.toLowerCase().includes(search)
      );
    }

    return true;
  });

  if (loading) {
    return <div className="p-4">Loading events...</div>;
  }

  return (
    <div className="p-4 h-full overflow-hidden flex flex-col">
      <div className="mb-4">
        <h2 className="text-2xl font-bold mb-4">Event Debug Panel</h2>

        <div className="flex gap-4 mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded ${filter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              All ({events.length})
            </button>
            <button
              onClick={() => setFilter('upcoming')}
              className={`px-3 py-1 rounded ${filter === 'upcoming' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Upcoming (
              {events.filter(e => DateUtils.getDebugInfo(e).isFuture).length})
            </button>
            <button
              onClick={() => setFilter('today')}
              className={`px-3 py-1 rounded ${filter === 'today' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Today (
              {events.filter(e => DateUtils.isToday(e.date || e.start)).length})
            </button>
            <button
              onClick={() => setFilter('past')}
              className={`px-3 py-1 rounded ${filter === 'past' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Past (
              {events.filter(e => !DateUtils.getDebugInfo(e).isFuture).length})
            </button>
          </div>

          <input
            type="text"
            placeholder="Search events..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="px-3 py-1 border rounded flex-1"
          />
        </div>

        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded mb-4">
          <strong>Debug Info:</strong> Showing {filteredEvents.length} events.
          Default timezone: {DateUtils.DEFAULT_TIMEZONE}. Current time:{' '}
          {new Date().toLocaleString()}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-gray-100">
            <tr>
              <th className="border p-1 text-left">Title</th>
              <th className="border p-1">Calendar</th>
              <th className="border p-1">Original Date</th>
              <th className="border p-1">Original Time</th>
              <th className="border p-1">Parsed Date</th>
              <th className="border p-1">UTC Time</th>
              <th className="border p-1">Local Time</th>
              <th className="border p-1">Timezone</th>
              <th className="border p-1">Duration</th>
              <th className="border p-1">Start</th>
              <th className="border p-1">End</th>
              <th className="border p-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map(event => {
              const debug = DateUtils.getDebugInfo(event);
              const rowClass = debug.isFuture
                ? DateUtils.isToday(event.date || event.start)
                  ? 'bg-green-50'
                  : 'bg-blue-50'
                : 'bg-gray-50';

              return (
                <tr key={event.id} className={rowClass}>
                  <td
                    className="border p-1 font-medium max-w-xs truncate"
                    title={event.title}
                  >
                    {event.title}
                  </td>
                  <td className="border p-1 text-center">
                    <span
                      className={`px-1 py-0.5 rounded text-xs ${
                        event.calendar_name === 'work'
                          ? 'bg-red-200'
                          : event.calendar_name === 'home'
                            ? 'bg-blue-200'
                            : event.calendar_name === 'meals'
                              ? 'bg-orange-200'
                              : 'bg-gray-200'
                      }`}
                    >
                      {event.calendar_name || 'unknown'}
                    </span>
                  </td>
                  <td
                    className="border p-1 font-mono text-xs"
                    title={debug.originalDate}
                  >
                    {debug.originalDate.substring(0, 19)}
                  </td>
                  <td className="border p-1 text-center font-mono">
                    {debug.originalTime}
                  </td>
                  <td className="border p-1 text-center">{debug.parsedDate}</td>
                  <td className="border p-1 text-center font-mono">
                    {debug.utcTime}
                  </td>
                  <td className="border p-1 text-center font-mono font-bold">
                    {debug.localTime}
                  </td>
                  <td className="border p-1 text-center text-xs">
                    {debug.timezone}
                  </td>
                  <td className="border p-1 text-center">
                    {event.duration || '-'}
                  </td>
                  <td
                    className="border p-1 font-mono text-xs"
                    title={event.start}
                  >
                    {event.start ? event.start.substring(11, 16) : '-'}
                  </td>
                  <td
                    className="border p-1 font-mono text-xs"
                    title={event.end}
                  >
                    {event.end ? event.end.substring(11, 16) : '-'}
                  </td>
                  <td className="border p-1 text-center">
                    <span
                      className={`px-1 py-0.5 rounded text-xs ${
                        debug.isFuture ? 'bg-green-200' : 'bg-gray-200'
                      }`}
                    >
                      {debug.isFuture ? 'Future' : 'Past'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
