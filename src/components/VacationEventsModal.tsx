import React, { useState, useEffect } from 'react';

interface VacationEvent {
  id: string;
  title: string;
  date: string;
  hours: number;
  user: string;
}

interface VacationEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VacationEventsModal: React.FC<VacationEventsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [events, setEvents] = useState<VacationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchVacationEvents();
    }
  }, [isOpen]);

  const fetchVacationEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/vacation-events');

      if (!response.ok) {
        throw new Error('Failed to fetch vacation events');
      }

      const data = await response.json();
      setEvents(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const groupEventsByUser = (events: VacationEvent[]) => {
    const grouped: { [key: string]: VacationEvent[] } = {};
    events.forEach(event => {
      if (!grouped[event.user]) {
        grouped[event.user] = [];
      }
      grouped[event.user].push(event);
    });
    return grouped;
  };

  const calculateTotalHours = (events: VacationEvent[]): number => {
    return events.reduce((total, event) => total + event.hours, 0);
  };

  if (!isOpen) return null;

  const groupedEvents = groupEventsByUser(events);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-800">
            Vacation Events
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              className="w-6 h-6"
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
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">{error}</div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No vacation events scheduled
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedEvents).map(([userName, userEvents]) => (
                <div key={userName} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-gray-700 capitalize">
                      {userName}
                    </h3>
                    <div className="text-sm text-gray-600">
                      Total: {calculateTotalHours(userEvents)} hours (
                      {userEvents.length} days)
                    </div>
                  </div>

                  <div className="space-y-2">
                    {userEvents.map(event => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between bg-white p-3 rounded border border-gray-200 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">
                            {event.title}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDate(event.date)}
                          </div>
                        </div>
                        <div className="ml-4">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                              event.hours > 0
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {event.hours > 0 ? `${event.hours}h` : 'Weekend'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t p-4 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Total vacation hours used: {calculateTotalHours(events)} hours
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VacationEventsModal;
