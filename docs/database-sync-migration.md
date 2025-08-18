# Database Sync and Migration System

## Overview

The Swanson Light Calendar application uses a robust database synchronization and migration system to keep calendar data consistent between CalDAV servers and the local SQLite database.

## Architecture

### Key Components

1. **SQLite Database** (`data/calendar.db`)
   - Local storage for calendar events
   - Supports offline operation
   - Tracks sync status and metadata

2. **CalDAV Repositories**
   - `CalDAVMultiCalendarRepository`: Manages multiple calendar sources
   - `CalDAVFetchRepository`: Handles HTTP communication with CalDAV servers
   - `CalDAVParserRepository`: Parses iCalendar data

3. **Database Repositories**
   - `SQLiteEventRepository`: Handles event CRUD operations
   - `SQLiteSyncRepository`: Manages sync state and deleted events
   - `SQLiteVacationRepository`: Tracks vacation balances

4. **Services**
   - `DatabaseCalendarService`: Orchestrates sync operations
   - `CalendarUpdateService`: Handles event creation/updates/deletions

## Database Schema

### Events Table
```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  start TEXT,              -- ISO date string for event start
  end TEXT,                -- ISO date string for event end
  description TEXT,
  location TEXT,
  organizer TEXT,
  attendees TEXT,          -- JSON array
  categories TEXT,         -- JSON array
  priority INTEGER,
  status TEXT,
  visibility TEXT,
  dtend TEXT,
  duration TEXT,
  rrule TEXT,
  created TEXT,
  last_modified TEXT,
  sequence INTEGER,
  url TEXT,
  geo_lat REAL,
  geo_lon REAL,
  transparency TEXT,
  attachments TEXT,        -- JSON array
  timezone TEXT,
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  caldav_etag TEXT,
  caldav_filename TEXT,    -- CalDAV file identifier
  calendar_path TEXT,      -- CalDAV calendar path
  calendar_name TEXT,      -- Calendar name (personal/work/shared)
  sync_status TEXT DEFAULT 'synced',
  local_modified DATETIME,
  is_vacation BOOLEAN DEFAULT 0
)
```

### Deleted Events Table
```sql
CREATE TABLE deleted_events (
  id TEXT PRIMARY KEY,
  deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  synced_to_caldav BOOLEAN DEFAULT 0
)
```

### Vacation Balances Table
```sql
CREATE TABLE vacation_balances (
  user_name TEXT PRIMARY KEY,
  balance_hours REAL NOT NULL DEFAULT 40.0,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

## Migration System

### Purpose
The migration system ensures database schema consistency across different environments (development, Raspberry Pi deployment).

### Migration Script (`scripts/migrate-database.js`)
- Runs automatically when the database schema needs updates
- Checks for missing columns/tables before applying changes
- Idempotent - safe to run multiple times
- Maintains backward compatibility

### Migration Process
1. **Check Phase**: Queries database schema to determine what needs updating
2. **Apply Phase**: Runs ALTER TABLE or CREATE TABLE statements as needed
3. **Verify Phase**: Confirms migrations were successful

### Current Migrations
1. **Add start and end columns**: Required fields for event time ranges
2. **Add CalDAV metadata columns**: Tracks CalDAV-specific information
3. **Add vacation column**: Supports vacation tracking feature
4. **Create vacation_balances table**: Stores user vacation balances
5. **Create deleted_events table**: Tracks deletions for sync

## Sync Process

### Sync Flow
1. **Fetch from CalDAV** (all three calendars: personal, work, shared)
2. **Transform Events** (parse iCalendar format to internal format)
3. **Detect Changes**
   - New events: Add to local database
   - Modified events: Update local database
   - Deleted events: Track in deleted_events table
4. **Save to Database** with proper metadata
5. **Clean Up** old events and sync tracking data

### Sync Endpoints
- `POST /admin/sync` - Triggers full synchronization
- `GET /api/events` - Retrieves events (triggers sync if needed)
- `POST /api/events` - Creates new event (syncs to CalDAV)
- `PUT /api/events/:id` - Updates event (syncs to CalDAV)
- `DELETE /api/events/:id` - Deletes event (syncs deletion to CalDAV)

### Conflict Resolution
- CalDAV is treated as the source of truth
- Local changes are pushed to CalDAV
- CalDAV changes override local changes during sync
- Deleted events are tracked to prevent resurrection

## SQL Parameter Mapping

### Column-to-Parameter Mapping
The system maintains strict 1:1 mapping between:
- Database columns (33 total)
- SQL placeholders (? marks)
- JavaScript parameters

### Parameter Order
```javascript
[
  event.id,                           // 1
  event.title,                        // 2
  event.date,                         // 3
  event.time,                         // 4
  event.start || event.date,          // 5
  event.end || event.dtend || date,   // 6
  event.description,                  // 7
  event.location,                     // 8
  event.organizer,                    // 9
  JSON.stringify(event.attendees),    // 10
  JSON.stringify(event.categories),   // 11
  event.priority,                     // 12
  event.status,                       // 13
  event.visibility,                   // 14
  event.dtend,                        // 15
  event.duration,                     // 16
  event.rrule,                        // 17
  event.created,                      // 18
  event.lastModified,                 // 19
  event.sequence,                     // 20
  event.url,                          // 21
  event.geo?.lat,                     // 22
  event.geo?.lon,                     // 23
  event.transparency,                 // 24
  JSON.stringify(event.attachments),  // 25
  event.timezone,                     // 26
  caldav_filename,                    // 27
  calendar_path,                      // 28
  calendar_name,                      // 29
  sync_status,                        // 30
  local_modified,                     // 31
  null, // synced_at uses DEFAULT     // 32
  event.isVacation ? 1 : 0            // 33
]
```

## Deployment

### Local Development
1. Database is created automatically in `./data/calendar.db`
2. Migrations run on first startup
3. Sync happens on server start and API calls

### Raspberry Pi Deployment
1. Pull latest code: `git pull`
2. Run migrations: `node scripts/migrate-database.js`
3. Build: `npm run build:server`
4. Start: `bash start-calendar.sh`

### Environment Variables
Required in `.env`:
```
CALDAV_USERNAME=your_email@gmail.com
CALDAV_PASSWORD=your_app_specific_password
```

## Troubleshooting

### Common Issues

1. **SQLITE_RANGE errors**
   - Cause: Mismatch between SQL columns and parameters
   - Solution: Ensure 33 columns, 33 placeholders, 33 parameters

2. **Missing columns**
   - Cause: Database schema out of date
   - Solution: Run `node scripts/migrate-database.js`

3. **Sync failures**
   - Check CalDAV credentials in `.env`
   - Verify network connectivity
   - Check server logs for specific errors

4. **TypeScript compilation errors**
   - Ensure `start` and `end` fields are in CalendarEvent interface
   - Check strict mode settings match between environments

### Debug Commands
```bash
# Check database schema
sqlite3 data/calendar.db ".schema events"

# Run migrations manually
node scripts/migrate-database.js

# Test sync endpoint
curl -X POST http://localhost:3001/admin/sync

# View sync logs
tail -f backend.log
```

## Best Practices

1. **Always run migrations** after pulling new code
2. **Test locally** before deploying to Pi
3. **Monitor sync logs** for failures
4. **Keep CalDAV credentials secure** (never commit `.env`)
5. **Use the start script** for consistent deployment

## Future Enhancements

1. **Incremental sync** using ETags for efficiency
2. **Conflict resolution UI** for manual resolution
3. **Sync status dashboard** for monitoring
4. **Automatic retry** with exponential backoff
5. **Multi-user support** with separate databases