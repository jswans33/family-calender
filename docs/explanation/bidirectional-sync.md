# Bidirectional CalDAV Sync - Standard Operating Procedure

## Overview

This system provides bidirectional synchronization between a local SQLite database and Apple CalDAV, ensuring events can be created/modified locally with fast response times while maintaining sync with Apple Calendar.

## Architecture Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Client    │────▶│   API Layer  │────▶│   SQLite    │────▶│  Apple       │
│   (React)   │◀────│   (Express)  │◀────│   Database  │◀────│  CalDAV      │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
                           │                     ▲                    ▲
                           │                     │                    │
                           └─────────────────────┴────────────────────┘
                                     Bidirectional Sync
```

## Database Schema

### Events Table Structure

```sql
events (
  id TEXT PRIMARY KEY,              -- Unique event identifier
  title TEXT NOT NULL,              -- Event title
  date TEXT NOT NULL,               -- ISO 8601 date
  time TEXT NOT NULL,               -- Time in HH:MM format
  description TEXT,                 -- Event description
  location TEXT,                    -- Event location
  -- ... other CalDAV fields ...
  sync_status TEXT DEFAULT 'synced', -- 'pending' | 'synced' | 'error'
  local_modified DATETIME,          -- Last local modification time
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

## Sync Status States

1. **`pending`** - Event created/modified locally, awaiting sync to CalDAV
2. **`synced`** - Event synchronized with CalDAV
3. **`error`** - Sync failed, needs retry

## API Endpoints

### Create Event (POST /events)

```bash
POST http://localhost:3001/events
Content-Type: application/json

{
  "title": "Event Title",
  "date": "2025-08-20T14:00:00.000Z",
  "time": "14:00",
  "description": "Event description",
  "location": "Event location"
}
```

**Process:**

1. Generate unique ID if not provided: `local-{timestamp}-{random}`
2. Save to SQLite with `sync_status = 'pending'`
3. Trigger background reverse sync
4. Return 201 with event ID

### Update Event (PUT /events/:id)

```bash
PUT http://localhost:3001/events/{event-id}
Content-Type: application/json

{
  "id": "event-id",
  "title": "Updated Title",
  "date": "2025-08-20T15:00:00.000Z",
  "time": "15:00",
  "description": "Updated description"
}
```

**Process:**

1. Update in SQLite with `sync_status = 'pending'`
2. Set `local_modified = CURRENT_TIMESTAMP`
3. Trigger background reverse sync
4. Return 200 on success

### Manual Sync (POST /admin/sync)

```bash
POST http://localhost:3001/admin/sync
```

**Process:**

1. **Forward Sync:** Fetch all events from CalDAV → SQLite
2. **Reverse Sync:** Push pending events from SQLite → CalDAV
3. Return sync statistics

## Sync Procedures

### Forward Sync (CalDAV → SQLite)

**Frequency:** Every 15 minutes or on-demand

1. Fetch all events from CalDAV using REPORT method
2. Parse iCalendar data to extract event fields
3. Bulk insert/update in SQLite with `sync_status = 'synced'`
4. Preserve existing `local_modified` timestamps

### Reverse Sync (SQLite → CalDAV)

**Trigger:** After local create/update or manual sync

1. Query database: `SELECT * FROM events WHERE sync_status = 'pending'`
2. For each pending event:
   - Generate iCalendar format (RFC 5545)
   - PUT to CalDAV with unique filename
   - On success (201/204): UPDATE `sync_status = 'synced'`
   - On failure: Log error, keep as 'pending' for retry

### Conflict Resolution

**Current Strategy:** Last-write-wins

- Local changes overwrite CalDAV on reverse sync
- CalDAV changes overwrite local on forward sync
- Future enhancement: Track ETags for proper conflict detection

## Event ID Conventions

### Local Events

- Format: `local-{timestamp}-{random}`
- Example: `local-1755297504693-sv6ns8`

### CalDAV Events

- Format: Preserve original CalDAV UID
- Example: `69E053D2-2F90-4CF9-9581-46C1F61A05C4`

### Test Events

- Format: `test-{purpose}-{timestamp}`
- Example: `test-from-db-1755297096`

## CalDAV Integration Details

### iCalendar Generation

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Swanson Light Calendar//EN
BEGIN:VEVENT
UID:{event.id}
DTSTAMP:{utc_timestamp}
DTSTART:{event_start_utc}
DTEND:{event_end_utc}
SUMMARY:{event.title}
DESCRIPTION:{event.description}
LOCATION:{event.location}
SEQUENCE:0
LAST-MODIFIED:{utc_timestamp}
END:VEVENT
END:VCALENDAR
```

### CalDAV URL Structure

```
https://{hostname}/{user-id}/calendars/{calendar-id}/{filename}.ics

Example:
https://p36-caldav.icloud.com/1110188709/calendars/home/event-1755297504711-tgx51xt3c9r.ics
```

## Monitoring & Debugging

### Check Sync Status

```sql
-- View pending events
SELECT id, title, sync_status, local_modified
FROM events
WHERE sync_status = 'pending';

-- Count by status
SELECT sync_status, COUNT(*)
FROM events
GROUP BY sync_status;
```

### Server Logs

- Event creation: `Event {id} created locally, marked for sync`
- Sync start: `Starting reverse sync: Local → CalDAV`
- Sync success: `Event {id} synced to CalDAV`
- Sync failure: `Failed to sync event {id} to CalDAV`

### Common Issues & Solutions

1. **401 Unauthorized**
   - Check CalDAV credentials in environment variables
   - Verify app-specific password is valid

2. **400 Bad Request**
   - Check iCalendar format (needs DTEND)
   - Verify date/time formats are UTC

3. **Events stuck in 'pending'**
   - Check server logs for sync errors
   - Manually trigger sync: `POST /admin/sync`
   - Verify CalDAV connectivity

## Testing Procedures

### Test Event Creation

```bash
# Create test event
curl -X POST http://localhost:3001/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Event",
    "date": "2025-08-20T10:00:00.000Z",
    "time": "10:00",
    "description": "Test description",
    "location": "Test location"
  }'

# Verify in database
sqlite3 data/calendar.db \
  "SELECT id, title, sync_status FROM events WHERE title LIKE 'Test%';"

# Check if synced to CalDAV (wait 2-3 seconds)
sqlite3 data/calendar.db \
  "SELECT id, sync_status FROM events WHERE title = 'Test Event';"
```

### Test Manual Sync

```bash
# Trigger full sync
curl -X POST http://localhost:3001/admin/sync

# Should return: {"success":true,"message":"Sync completed"}
```

## Performance Metrics

- **Local Read:** <10ms (from SQLite)
- **Local Write:** <50ms (to SQLite + background sync)
- **CalDAV Sync:** 200-800ms per event
- **Bulk Sync:** ~2 seconds for 275 events

## Future Enhancements

1. **Incremental Sync** - Use ETags to sync only changed events
2. **Conflict Detection** - Compare timestamps and ETags
3. **Retry Queue** - Automatic retry for failed syncs
4. **Sync Status UI** - Show pending/synced status in frontend
5. **Offline Queue** - Queue changes when CalDAV unavailable

## Maintenance Tasks

### Daily

- Monitor pending events count
- Check for sync errors in logs

### Weekly

- Verify CalDAV connectivity
- Review sync performance metrics

### Monthly

- Clean old events: `DELETE FROM events WHERE date < DATE('now', '-6 months')`
- Backup database: `cp data/calendar.db data/calendar-backup-$(date +%Y%m%d).db`

---

**Last Updated:** 2025-08-15
**Version:** 1.0
**Status:** Production Ready
