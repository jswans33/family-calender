import React, { useState, useEffect } from 'react';
import { CalendarEvent } from '../../types/shared';
import { API_CONFIG, EVENT_CONFIG } from '../../config/constants';

export interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Partial<CalendarEvent> & { calendar_name?: string }) => void;
  initialData?:
    | {
        date: string;
        time?: string;
        event?: CalendarEvent;
      }
    | undefined;
  isEditing?: boolean;
  selectedCalendar?: string;
}

/**
 * EventModal - Modal for creating and editing events
 *
 * Features:
 * - Create new events with basic info
 * - Pre-fill date/time from clicked slot
 * - Form validation
 * - Clean, accessible interface
 */
export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  isEditing = false,
  selectedCalendar = 'home',
}) => {
  const existingEvent = initialData?.event;

  const [calendars, setCalendars] = useState<
    Array<{ name: string; displayName: string; count: number }>
  >([]);
  const [formData, setFormData] = useState(() => {
    // Debug logging
    console.log('EventModal initializing with:', {
      existingEvent,
      initialData,
      isEditing,
    });

    // Calculate end date from dtend if available
    let endDate = existingEvent?.date || initialData?.date || '';
    if (existingEvent?.dtend) {
      const dtendDate = new Date(existingEvent.dtend);
      endDate = dtendDate.toISOString().split('T')[0] || endDate;
    }

    return {
      title: existingEvent?.title || '',
      description: existingEvent?.description || '',
      location: existingEvent?.location || '',
      startDate: existingEvent?.date
        ? existingEvent.date.split('T')[0]
        : initialData?.date || '',
      endDate,
      time: existingEvent?.time || initialData?.time || '',
      duration: existingEvent?.duration
        ? existingEvent.duration
            .replace('PT', '')
            .replace('M', '')
            .replace('H', '')
        : EVENT_CONFIG.DEFAULT_DURATION,
      url: existingEvent?.url || '',
      categories: existingEvent?.categories?.join(', ') || '',
      calendar: existingEvent?.calendar_name || selectedCalendar,
      isVacation: existingEvent?.isVacation || false,
      isAllDay:
        !existingEvent?.time ||
        existingEvent?.time === '' ||
        existingEvent?.duration === 'PT24H0M',
    };
  });

  useEffect(() => {
    const fetchCalendars = async () => {
      try {
        const response = await fetch(
          `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CALENDARS}`
        );
        const calendarsData = await response.json();
        setCalendars(calendarsData);
      } catch (error) {
        // Calendar fetch failed - fallback behavior
      }
    };

    if (isOpen) {
      fetchCalendars();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) return;

    // Calculate end time if duration is provided and not all-day
    let dtend: string | undefined;
    if (!formData.isAllDay && formData.time && formData.duration) {
      const startDate = new Date(`${formData.startDate}T${formData.time}:00`);
      const endDate = new Date(
        startDate.getTime() + parseInt(formData.duration) * 60000
      );
      dtend = endDate.toISOString();
    } else if (
      formData.isAllDay &&
      formData.endDate &&
      formData.endDate !== formData.startDate
    ) {
      // For multi-day all-day events, set dtend to end of end date
      const endDate = new Date(`${formData.endDate}T23:59:59`);
      dtend = endDate.toISOString();
    }

    const newEvent: Partial<CalendarEvent> & { calendar_name?: string } = {
      ...(isEditing && existingEvent
        ? { id: existingEvent.id }
        : { id: `temp-${Date.now()}` }),
      title: formData.title.trim(),
      date: formData.startDate,
      time: formData.isAllDay ? '' : formData.time || '',
      calendar_name: formData.calendar,
      ...(formData.description.trim() && {
        description: formData.description.trim(),
      }),
      ...(formData.location.trim() && { location: formData.location.trim() }),
      ...(formData.url.trim() && { url: formData.url.trim() }),
      ...(dtend && { dtend }),
      ...(formData.isAllDay
        ? { duration: 'PT24H0M' }
        : formData.duration && { duration: `PT${formData.duration}M` }),
      ...(formData.categories.trim() && {
        categories: formData.categories.split(',').map(c => c.trim()),
      }),
      status: 'CONFIRMED',
      isVacation: formData.isVacation,
      // Preserve original user input
      original_date: formData.startDate,
      original_time: formData.isAllDay ? '' : formData.time || '',
      original_duration: formData.isAllDay
        ? 'PT24H0M'
        : `PT${formData.duration}M`,
      creation_source: 'user' as const,
      ...(isEditing && existingEvent
        ? {
            created: existingEvent.created || new Date().toISOString(),
            lastModified: new Date().toISOString(),
            sequence: (existingEvent.sequence || 0) + 1,
          }
        : {
            created: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            sequence: 0,
          }),
    };

    onSave(newEvent);
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      title: '',
      description: '',
      location: '',
      startDate: initialData?.date || '',
      endDate: initialData?.date || '',
      time: initialData?.time || '',
      duration: EVENT_CONFIG.DEFAULT_DURATION,
      url: '',
      categories: '',
      calendar: selectedCalendar,
      isVacation: false,
      isAllDay: false,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      tabIndex={-1}
      onClick={e => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      onKeyDown={e => {
        if (e.key === 'Escape') {
          handleClose();
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 id="modal-title" className="text-xl font-semibold text-gray-900">
            {isEditing ? 'Edit Event' : 'Create Event'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Event Title */}
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Event Title *
            </label>
            <input
              type="text"
              id="title"
              required
              value={formData.title}
              onChange={e =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter event title"
            />
          </div>

          {/* All Day Checkbox */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isAllDay"
              checked={formData.isAllDay}
              disabled={formData.startDate !== formData.endDate}
              onChange={e =>
                setFormData({
                  ...formData,
                  isAllDay: e.target.checked,
                  time: e.target.checked ? '' : formData.time,
                })
              }
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
            />
            <label
              htmlFor="isAllDay"
              className={`ml-2 block text-sm ${formData.startDate !== formData.endDate ? 'text-gray-400' : 'text-gray-700'}`}
            >
              All day event{' '}
              {formData.startDate !== formData.endDate
                ? '(required for multi-day)'
                : ''}
            </label>
          </div>

          {/* Start and End Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="startDate"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Start Date *
              </label>
              <input
                type="date"
                id="startDate"
                required
                value={formData.startDate}
                onChange={e => {
                  const newStartDate = e.target.value;
                  const newEndDate =
                    formData.endDate < newStartDate
                      ? newStartDate
                      : formData.endDate;
                  const isMultiDay = newStartDate !== newEndDate;

                  setFormData({
                    ...formData,
                    startDate: newStartDate,
                    endDate: newEndDate,
                    // Auto-set all-day for multi-day events
                    isAllDay: isMultiDay || formData.isAllDay,
                    // Clear time for multi-day events
                    time: isMultiDay ? '' : formData.time,
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="endDate"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                End Date *
              </label>
              <input
                type="date"
                id="endDate"
                required
                value={formData.endDate}
                min={formData.startDate}
                onChange={e => {
                  const newEndDate = e.target.value;
                  const isMultiDay = formData.startDate !== newEndDate;

                  setFormData({
                    ...formData,
                    endDate: newEndDate,
                    // Auto-set all-day for multi-day events
                    isAllDay: isMultiDay || formData.isAllDay,
                    // Clear time for multi-day events
                    time: isMultiDay ? '' : formData.time,
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Time - Only show if not all day */}
          {!formData.isAllDay && (
            <div>
              <label
                htmlFor="time"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Time
              </label>
              <input
                type="time"
                id="time"
                value={formData.time}
                onChange={e =>
                  setFormData({ ...formData, time: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          {/* Duration - Only show if not all day and single day */}
          {!formData.isAllDay && formData.startDate === formData.endDate && (
            <div>
              <label
                htmlFor="duration"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Duration (minutes)
              </label>
              <select
                id="duration"
                value={formData.duration}
                onChange={e =>
                  setFormData({ ...formData, duration: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {EVENT_CONFIG.DURATION_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Calendar Selection */}
          <div>
            <label
              htmlFor="calendar"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Calendar *
            </label>
            <select
              id="calendar"
              value={formData.calendar}
              onChange={e =>
                setFormData({ ...formData, calendar: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              {calendars.length > 0 ? (
                calendars.map(cal => (
                  <option key={cal.name} value={cal.name}>
                    {cal.displayName ||
                      cal.name.charAt(0).toUpperCase() + cal.name.slice(1)}{' '}
                    ({cal.count} events)
                  </option>
                ))
              ) : (
                <>
                  <option value="home">Home</option>
                  <option value="work">Work</option>
                  <option value="shared">Shared</option>
                </>
              )}
            </select>
          </div>

          {/* Vacation Checkbox - Only for work calendar */}
          {formData.calendar === 'work' && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isVacation"
                checked={formData.isVacation}
                onChange={e =>
                  setFormData({ ...formData, isVacation: e.target.checked })
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label
                htmlFor="isVacation"
                className="ml-2 block text-sm text-gray-700"
              >
                This is a vacation day (deducts 8 hours from vacation balance)
              </label>
            </div>
          )}

          {/* Location */}
          <div>
            <label
              htmlFor="location"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Location
            </label>
            <input
              type="text"
              id="location"
              value={formData.location}
              onChange={e =>
                setFormData({ ...formData, location: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter location"
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description
            </label>
            <textarea
              id="description"
              rows={3}
              value={formData.description}
              onChange={e =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Event description"
            />
          </div>

          {/* Meeting URL */}
          <div>
            <label
              htmlFor="url"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Meeting URL
            </label>
            <input
              type="url"
              id="url"
              value={formData.url}
              onChange={e => setFormData({ ...formData, url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://zoom.us/j/..."
            />
          </div>

          {/* Categories */}
          <div>
            <label
              htmlFor="categories"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Categories
            </label>
            <input
              type="text"
              id="categories"
              value={formData.categories}
              onChange={e =>
                setFormData({ ...formData, categories: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="work, meeting, personal (comma separated)"
            />
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formData.title.trim()}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isEditing ? 'Update Event' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
