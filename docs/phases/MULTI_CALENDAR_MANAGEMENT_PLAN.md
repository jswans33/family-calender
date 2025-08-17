# MULTI-CALENDAR MANAGEMENT PLAN

## PROBLEM
- Currently only syncs with "Shared" calendar (1 event)
- User has multiple calendars: Home (274 events), Work, Meals
- Need ability to create/read/delete events from ANY calendar
- Filename mapping issue exists across all calendars

## CURRENT CALENDARS DISCOVERED
1. **Shared** (`/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/`) - 1 event - "Buy chips"
2. **Home** (`/home/`) - 274 events (MAIN CALENDAR) - All real events  
3. **Work** (`/work/`) - 44 events - Work-related events
4. **Meals** (`/1fa1e4097e27af6d41607163c20c088e70cf8e9db9d71b1a62611ec364123914/`) - 1 event - Meal planning

**TOTAL: 320 events across 4 calendars**

## CALENDAR ACCESS INFORMATION
- **Base URL**: `https://p36-caldav.icloud.com/1110188709/calendars`
- **Auth**: Basic auth with `jswans33@gmail.com:qrdq-tahw-xski-ogbf`
- **CRUD Operations**: Need calendar_path parameter for each operation

## FIELD MAPPING BETWEEN SYSTEMS
### CalDAV → Our App
- `UID` → `event.id`
- `SUMMARY` → `event.title` 
- `DTSTART` → `event.date`
- `DTEND` → `event.dtend`
- `DESCRIPTION` → `event.description`
- `LOCATION` → `event.location`
- CalDAV filename → `event.caldav_filename` (NEW FIELD)
- Calendar path → `event.calendar_path` (NEW FIELD)
- Calendar name → `event.calendar_name` (NEW FIELD)

### Database Schema Updates Needed
```sql
ALTER TABLE events ADD COLUMN calendar_path TEXT;
ALTER TABLE events ADD COLUMN calendar_name TEXT;
-- caldav_filename already added
```

## SOLUTION ARCHITECTURE

### 1. DATABASE SCHEMA CHANGES
```sql
ALTER TABLE events ADD COLUMN calendar_path TEXT;
ALTER TABLE events ADD COLUMN calendar_name TEXT;
-- caldav_filename already added
```

### 2. CALDAV CONFIG CHANGES
- Remove hardcoded calendar path from `CalDAVConfig.ts`
- Add calendar selection parameter to all CRUD operations
- Support dynamic calendar switching in `CalDAVRepository.ts`

### 3. API ENDPOINTS EXPANSION  
```
GET  /events?calendar=home          # Get events from Home calendar (274 events)
GET  /events?calendar=work          # Get events from Work calendar (44 events)
GET  /events?calendar=shared        # Get events from Shared calendar (1 event)
GET  /events?calendar=meals         # Get events from Meals calendar (1 event)
POST /events?calendar=home          # Create in specific calendar  
PUT  /events/:id?calendar=home      # Update in specific calendar
DELETE /events/:id?calendar=home    # Delete from specific calendar using filename mapping
GET  /calendars                     # List all 4 available calendars with counts
```

### 4. CRUD OPERATIONS FOR EACH CALENDAR
**CREATE**: `POST /events?calendar={calendar_name}`
- Store: `calendar_path`, `calendar_name`, `caldav_filename` 
- Use calendar path in CalDAV PUT request

**READ**: `GET /events?calendar={calendar_name}`  
- Filter by `calendar_path` in database
- Sync from correct CalDAV calendar path

**UPDATE**: `PUT /events/:id?calendar={calendar_name}`
- Use stored `caldav_filename` and `calendar_path`
- CalDAV PUT to correct calendar

**DELETE**: `DELETE /events/:id?calendar={calendar_name}`
- Use stored `caldav_filename` and `calendar_path` 
- CalDAV DELETE to correct calendar with correct filename

### 4. FILENAME MAPPING SOLUTION
- Query CalDAV for actual filenames during sync
- Store mapping: `{event_id: 'local-123', caldav_filename: 'ABC123.ics', calendar_path: '/home/'}`
- Use stored filename for deletion operations

### 5. IMPLEMENTATION PHASES

**PHASE 1: Multi-Calendar Support**
1. Update CalDAVRepository to accept calendar_path parameter
2. Add calendar selection to all CRUD operations
3. Update database schema

**PHASE 2: Filename Mapping Fix**  
1. Extract filenames during sync operations
2. Store filename mappings in database
3. Use mappings for deletions

**PHASE 3: UI/API Integration**
1. Add calendar selector to frontend
2. Update all API calls to include calendar parameter
3. Test CRUD operations across all calendars

## BACKEND SERVER UPDATE PLAN

### CURRENT ARCHITECTURE ANALYSIS

### ACTUAL DATA FLOW (API → DATABASE → CalDAV)
```
Client Request → CalendarController → DatabaseCalendarService → SQLiteRepository (PRIMARY)
                                               ↓
                                    CalDAVRepository (SYNC ONLY)
```

**KEY FINDING: API CONNECTS TO DATABASE, NOT CALDAV DIRECTLY**

### CURRENT SERVER ISSUES
- `CalDAVConfig.ts` hardcoded to `/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/` (Shared only)
- `CalDAVRepository.ts` uses fixed path in all CRUD operations  
- `DatabaseCalendarService.ts` only syncs one calendar
- No calendar selection in API endpoints
- **CRITICAL**: All API requests read/write to SQLite database FIRST, CalDAV is sync background only

### ARCHITECTURE PATTERNS DISCOVERED
1. **server.ts:32-36** - Creates DatabaseCalendarService with both CalDAV and SQLite repositories
2. **CalendarController.ts:19** - ALL endpoints call `this.calendarService.getEvents()` (database-first)
3. **DatabaseCalendarService.ts:32** - `getEvents()` reads from `sqliteRepository.getEvents()` FIRST
4. **DatabaseCalendarService.ts:34-36** - CalDAV is only used for background sync, not direct API calls
5. **DatabaseCalendarService.ts:291** - `syncLocalToCalDAV()` runs in background to push changes UP to CalDAV
6. **DatabaseCalendarService.ts:55** - `forceSync()` pulls CalDAV events DOWN to database

### REPOSITORY SEPARATION REQUIRED

**PROBLEM**: Current system mixes database and CalDAV operations in single service

**SOLUTION**: Separate repositories with clear boundaries
```
DatabaseCalendarService (Orchestrator)
├── CalDAVSyncRepository (CalDAV-only operations)
└── SQLiteRepository (Database-only operations)
```

**NEW ARCHITECTURE NEEDED**:
1. **CalDAVSyncRepository** - Pure CalDAV operations (create/read/update/delete from iCloud)
2. **SQLiteRepository** - Pure database operations (local storage/cache)  
3. **DatabaseCalendarService** - Orchestrates between the two repositories
4. **Multi-calendar support** - Both repositories accept calendar_path parameter

### BACKEND CHANGES NEEDED

#### 1. UPDATE CalDAVConfig.ts
```typescript
// REMOVE: hardcoded path
// ADD: calendar mapping
static getCalendarPath(calendarName: string): string {
  const calendars = {
    'shared': '/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/',
    'home': '/home/',
    'work': '/work/', 
    'meals': '/1fa1e4097e27af6d41607163c20c088e70cf8e9db9d71b1a62611ec364123914/'
  };
  return calendars[calendarName] || calendars['shared'];
}
```

#### 2. CALDAV REPOSITORY UPDATE PLAN - EXACT CHANGES

**CURRENT METHOD SIGNATURES (server-src/repositories/CalDAVRepository.ts):**
```typescript
// LINE 43: fetchCalendarData(startDate?: Date, endDate?: Date): Promise<string>
// LINE 312: createEvent(event: CalendarEvent): Promise<boolean>  
// LINE 394: deleteEvent(eventId: string): Promise<boolean>
// LINE 350: updateEvent(event: CalendarEvent): Promise<boolean>
```

**NEW METHOD SIGNATURES REQUIRED:**
```typescript
// ADD calendar_path parameter to every method
async fetchCalendarData(calendar_path: string, startDate?: Date, endDate?: Date): Promise<string>
async createEvent(event: CalendarEvent, calendar_path: string): Promise<boolean>
async deleteEvent(eventId: string, calendar_path: string, filename: string): Promise<boolean>  
async updateEvent(event: CalendarEvent, calendar_path: string): Promise<boolean>

// ADD new multi-calendar methods
async getAllCalendars(): Promise<{name: string, path: string, count: number}[]>
async getAllEventsFromAllCalendars(): Promise<{calendar: string, events: CalendarEvent[]}[]>
async parseCalendarEventsWithFilenames(xmlData: string): {event: CalendarEvent, filename: string}[]
```

**EXACT CODE CHANGES:**

**Change 1 - fetchCalendarData (line ~50):**
```typescript
// CURRENT: path: this.credentials.path,
// CHANGE TO: path: calendar_path,
const options: https.RequestOptions = {
  hostname: this.credentials.hostname,
  port: 443,
  path: calendar_path, // DYNAMIC PATH INSTEAD OF this.credentials.path
  method: 'REPORT',
  // ... rest unchanged
};
```

**Change 2 - createEvent (line ~320):**
```typescript
// CURRENT: const eventUrl = `${this.credentials.path}${filename}`;
// CHANGE TO: const eventUrl = `${calendar_path}${filename}`;
const eventUrl = `${calendar_path}${filename}`;
```

**Change 3 - deleteEvent (line ~400):**
```typescript
// CURRENT: const eventUrl = `${this.credentials.path}${encodedEventId}.ics`;
// CHANGE TO: const eventUrl = `${calendar_path}${filename}`;
const eventUrl = `${calendar_path}${filename}`; // Use actual filename, not encoded ID
```

**Change 4 - updateEvent (line ~360):**
```typescript
// CURRENT: const eventUrl = `${this.credentials.path}${encodedEventId}.ics`;
// CHANGE TO: const eventUrl = `${calendar_path}${encodedEventId}.ics`;
const eventUrl = `${calendar_path}${encodedEventId}.ics`;
```

**NEW METHOD IMPLEMENTATIONS:**

**Add getAllCalendars():**
```typescript
async getAllCalendars(): Promise<{name: string, path: string, count: number}[]> {
  // Implement logic from get_all_caldav_events.sh
  // PROPFIND request to discover all calendars
  // Return calendar metadata with event counts
}
```

**Add getAllEventsFromAllCalendars():**
```typescript
async getAllEventsFromAllCalendars(): Promise<{calendar: string, events: CalendarEvent[]}[]> {
  const calendars = [
    {name: 'shared', path: '/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/'},
    {name: 'home', path: '/home/'},
    {name: 'work', path: '/work/'},
    {name: 'meals', path: '/1fa1e4097e27af6d41607163c20c088e70cf8e9db9d71b1a62611ec364123914/'}
  ];
  
  const results = [];
  for (const cal of calendars) {
    const xmlData = await this.fetchCalendarData(cal.path);
    const events = this.parseCalendarEvents(xmlData);
    // ADD: Extract filenames and store in events
    results.push({calendar: cal.name, events});
  }
  return results; // Returns all 320 events across 4 calendars
}
```

**TYPESCRIPT COMPLIANCE:**
- All method signatures updated with proper types
- calendar_path: string (required parameter)
- filename: string (for delete - from database)
- Return types unchanged: Promise<string> | Promise<boolean>
- No breaking changes to existing CalendarEvent interface

#### 3. UPDATE DatabaseCalendarService.ts - EXACT CHANGES

**CURRENT METHODS THAT NEED CALENDAR_PATH:**
```typescript
// LINE 63: this.calDAVRepository.fetchCalendarData()  - NO calendar_path
// LINE 99: this.calDAVRepository.deleteEvent(eventId) - NO calendar_path/filename
// LINE 271: this.calDAVRepository.deleteEvent(eventId) - NO calendar_path/filename  
// LINE 312: this.calDAVRepository.createEvent(event) - NO calendar_path
```

**CHANGES REQUIRED:**
```typescript
// Change 1 - forceSync() line ~63
// CURRENT: const xmlData = await this.calDAVRepository.fetchCalendarData();
// CHANGE TO: Multi-calendar sync
async forceSync(): Promise<void> {
  console.log('Force syncing events from all CalDAV calendars...');
  
  // Sync deletions first
  await this.syncDeletionsToCalDAV();
  
  // Sync all calendars
  const calendars = [
    {name: 'shared', path: '/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/'},
    {name: 'home', path: '/home/'},
    {name: 'work', path: '/work/'},
    {name: 'meals', path: '/1fa1e4097e27af6d41607163c20c088e70cf8e9db9d71b1a62611ec364123914/'}
  ];
  
  const allEvents = [];
  for (const cal of calendars) {
    const xmlData = await this.calDAVRepository.fetchCalendarData(cal.path);
    const events = this.calDAVRepository.parseCalendarEvents(xmlData);
    
    // ADD calendar metadata to each event
    events.forEach(event => {
      event.calendar_path = cal.path;
      event.calendar_name = cal.name;
      // TODO: Extract caldav_filename from XML
    });
    
    allEvents.push(...events);
  }
  
  await this.sqliteRepository.saveEventsWithSmartSync(allEvents);
  console.log(`Synced ${allEvents.length} events from all calendars`);
}

// Change 2 - syncDeletionsToCalDAV() line ~99  
// CURRENT: await this.calDAVRepository.deleteEvent(eventId);
// CHANGE TO: Include calendar_path and filename
private async syncDeletionsToCalDAV(): Promise<void> {
  const deletedEvents = await this.sqliteRepository.getDeletedEventsWithMetadata(); // NEW METHOD
  
  for (const deletedEvent of deletedEvents) {
    try {
      await this.calDAVRepository.deleteEvent(
        deletedEvent.eventId, 
        deletedEvent.calendar_path, 
        deletedEvent.caldav_filename
      );
      await this.sqliteRepository.markDeletedEventSynced(deletedEvent.eventId);
    } catch (error) {
      console.log(`Event ${deletedEvent.eventId} delete failed:`, error);
    }
  }
}

// Change 3 - deleteEvent() line ~271
// CURRENT: await this.calDAVRepository.deleteEvent(eventId);
// CHANGE TO: Get calendar metadata from database first
async deleteEvent(eventId: string): Promise<boolean> {
  // Get event metadata from database
  const eventMeta = await this.sqliteRepository.getEventMetadata(eventId); // NEW METHOD
  
  if (!eventMeta) {
    console.log(`Event ${eventId} not found in database`);
    return false;
  }
  
  // Delete from database first
  const dbSuccess = await this.sqliteRepository.deleteEvent(eventId);
  
  if (dbSuccess) {
    // Delete from CalDAV using stored metadata
    try {
      await this.calDAVRepository.deleteEvent(
        eventId, 
        eventMeta.calendar_path, 
        eventMeta.caldav_filename
      );
    } catch (caldavError) {
      console.log(`CalDAV delete failed for ${eventId}:`, caldavError);
    }
  }
  
  return dbSuccess;
}

// Change 4 - syncLocalToCalDAV() line ~312
// CURRENT: await this.calDAVRepository.createEvent(event);
// CHANGE TO: Include calendar_path for creation
async syncLocalToCalDAV(): Promise<void> {
  const pendingEvents = await this.sqliteRepository.getPendingEvents();
  
  for (const event of pendingEvents) {
    try {
      // Use stored calendar_path or default to 'shared'
      const calendar_path = event.calendar_path || '/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/';
      
      // Delete-then-create approach
      await this.calDAVRepository.deleteEvent(
        event.id, 
        calendar_path, 
        event.caldav_filename || `${event.id}.ics`
      ).catch(() => {}); // Ignore delete errors
      
      // Create with calendar_path
      const success = await this.calDAVRepository.createEvent(event, calendar_path);
      
      if (success) {
        await this.sqliteRepository.markEventSynced(event.id);
      }
    } catch (error) {
      console.error(`Error syncing event ${event.id}:`, error);
    }
  }
}
```

#### 4. UPDATE server.ts API ENDPOINTS - EXACT CHANGES

**CURRENT ENDPOINTS (NO CALENDAR SUPPORT):**
```typescript  
// LINE 40: app.get('/events', (req, res) => calendarController.getEvents(req, res));
// LINE 54: app.post('/events', (req, res) => calendarController.createEvent(req, res));
// LINE 50: app.put('/events/:id', (req, res) => calendarController.updateEvent(req, res));
// LINE 51: app.delete('/events/:id', (req, res) => calendarController.deleteEvent(req, res));
```

**NEW ENDPOINTS NEEDED:**
```typescript
// Change 1 - Add calendar discovery endpoint  
app.get('/calendars', async (req, res) => {
  try {
    // Return all 4 calendars with event counts
    const calendars = [
      {name: 'shared', path: '/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/', count: 1},
      {name: 'home', path: '/home/', count: 274},
      {name: 'work', path: '/work/', count: 44},
      {name: 'meals', path: '/1fa1e4097e27af6d41607163c20c088e70cf8e9db9d71b1a62611ec364123914/', count: 1}
    ];
    res.json(calendars);
  } catch (error) {
    res.status(500).json({error: 'Failed to fetch calendars'});
  }
});

// Change 2 - Update existing routes to support calendar parameter
// CURRENT: app.get('/events', (req, res) => calendarController.getEvents(req, res));
// CHANGE TO: Pass calendar parameter to controller
app.get('/events', (req, res) => {
  // Add calendar parameter to request for controller
  req.query.calendar = req.query.calendar || 'shared';
  calendarController.getEvents(req, res);
});

app.post('/events', (req, res) => {
  req.query.calendar = req.query.calendar || 'shared';
  calendarController.createEvent(req, res);
});

app.put('/events/:id', (req, res) => {
  req.query.calendar = req.query.calendar || 'shared';
  calendarController.updateEvent(req, res);
});

app.delete('/events/:id', (req, res) => {
  req.query.calendar = req.query.calendar || 'shared';
  calendarController.deleteEvent(req, res);
});
```

**NEW API USAGE:**
```bash
# Get events from specific calendar
GET /events?calendar=home         # 274 events
GET /events?calendar=work         # 44 events 
GET /events?calendar=shared       # 1 event
GET /events?calendar=meals        # 1 event

# Create event in specific calendar
POST /events?calendar=home -d '{"title":"New Home Event"}'

# Update event in specific calendar  
PUT /events/{id}?calendar=home -d '{"title":"Updated Event"}'

# Delete event from specific calendar
DELETE /events/{id}?calendar=home

# List all calendars
GET /calendars
# Returns: [{"name":"home","count":274}, {"name":"work","count":44}, ...]
```

#### 5. UPDATE SQLiteRepository.ts - EXACT CHANGES

**CURRENT METHODS NEEDING CALENDAR SUPPORT:**
```typescript
// LINE ~150: getEvents(startDate?: Date, endDate?: Date)  - NO calendar filtering
// LINE ~XXX: Need getDeletedEventsWithMetadata() - MISSING METHOD
// LINE ~XXX: Need getEventMetadata(eventId) - MISSING METHOD  
```

**EXACT CHANGES:**
```typescript
// Change 1 - Update getEvents to support calendar filtering
// CURRENT: async getEvents(startDate?: Date, endDate?: Date): Promise<CalendarEvent[]>
// CHANGE TO: async getEvents(calendar_path?: string, startDate?: Date, endDate?: Date): Promise<CalendarEvent[]>
async getEvents(calendar_path?: string, startDate?: Date, endDate?: Date): Promise<CalendarEvent[]> {
  let query = 'SELECT * FROM events WHERE deleted_at IS NULL';
  const params: any[] = [];
  
  // Add calendar filtering
  if (calendar_path) {
    query += ' AND calendar_path = ?';
    params.push(calendar_path);
  }
  
  // Add date filtering
  if (startDate && endDate) {
    query += ' AND date BETWEEN ? AND ?';
    params.push(startDate.toISOString(), endDate.toISOString());
  }
  
  query += ' ORDER BY date ASC';
  
  return new Promise((resolve, reject) => {
    this.db.all(query, params, (err: Error | null, rows: any[]) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows as CalendarEvent[]);
      }
    });
  });
}

// Change 2 - Add getDeletedEventsWithMetadata() method  
async getDeletedEventsWithMetadata(): Promise<{eventId: string, calendar_path: string, caldav_filename: string}[]> {
  const query = `
    SELECT 
      de.event_id as eventId,
      e.calendar_path,
      e.caldav_filename
    FROM deleted_events de
    LEFT JOIN events e ON de.event_id = e.id
    WHERE de.synced_at IS NULL
  `;
  
  return new Promise((resolve, reject) => {
    this.db.all(query, [], (err: Error | null, rows: any[]) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Change 3 - Add getEventMetadata() method
async getEventMetadata(eventId: string): Promise<{calendar_path: string, caldav_filename: string} | null> {
  const query = 'SELECT calendar_path, caldav_filename FROM events WHERE id = ? AND deleted_at IS NULL';
  
  return new Promise((resolve, reject) => {
    this.db.get(query, [eventId], (err: Error | null, row: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(row || null);
      }
    });
  });
}

// Change 4 - Ensure saveEvents stores calendar metadata
// UPDATE existing saveEvents/saveEventsWithSmartSync to handle:
// - event.calendar_path
// - event.calendar_name  
// - event.caldav_filename
```

**NEW DATABASE COLUMNS REQUIRED:**
```sql
-- Add to existing events table
ALTER TABLE events ADD COLUMN calendar_path TEXT;
ALTER TABLE events ADD COLUMN calendar_name TEXT;
-- caldav_filename already exists
```

### USING get_all_caldav_events.sh FOR VALIDATION
1. **Before changes**: Run script to capture current state
2. **After each change**: Run script to verify no events lost
3. **Test each calendar**: Verify CRUD works on all 4 calendars
4. **Filename mapping**: Extract and store filenames during sync

### SAFE IMPLEMENTATION ORDER
1. **Backup**: Run script to save current state
2. **Database**: Add new columns 
3. **Config**: Update calendar mapping
4. **Repository**: Add calendar_path parameters
5. **Service**: Update sync logic
6. **API**: Add calendar parameter
7. **Test**: Verify with script after each step

### VALIDATION SCRIPT USAGE
```bash
# Before changes
./get_all_caldav_events.sh > /tmp/before_changes.txt

# After each change
./get_all_caldav_events.sh > /tmp/after_step_X.txt
diff /tmp/before_changes.txt /tmp/after_step_X.txt

# Verify all 320 events still accessible
```

### ZERO ESLINT/TS ERRORS COMPLIANCE

#### REQUIRED CHECKS AFTER EACH CHANGE:
```bash
# TypeScript compilation 
npm run type-check:server
# Must show: Found 0 errors

# ESLint validation
npm run lint:server  
# Must show: No linting errors

# Build validation
npm run build:server
# Must complete without errors

# Server startup test
npm run start:server:dev
# Must start without crashes
```

#### TYPESCRIPT INTERFACE UPDATES NEEDED:
```typescript
// Update CalDAVCredentials interface
interface CalDAVCredentials {
  username: string;
  password: string;
  hostname: string;
  // REMOVE: path: string; // No longer hardcoded
}

// Add calendar mapping type
type CalendarName = 'shared' | 'home' | 'work' | 'meals';
type CalendarPath = string;
```

#### ESLINT RULE COMPLIANCE:
- All async functions must have proper error handling
- No unused variables after parameter changes
- Proper TypeScript strict mode compliance
- No implicit any types
- All promises must be properly awaited

## QUALITY GATES & SUB-FEATURE TESTING

### 1. CALENDAR CONNECTION & DISCOVERY
**Quality Gate**: Can connect to and list all 4 calendars
```bash
# Test Command
./get_all_caldav_events.sh | grep "Events found:"
# Expected Output:
# Events found: 1    (Shared)
# Events found: 274  (Home) 
# Events found: 44   (Work)
# Events found: 1    (Meals)
# PASS: All 4 calendars respond
# FAIL: Missing any calendar or wrong counts
```

### 2. EVENT EXTRACTION PER CALENDAR
**Quality Gate**: Extract all event names from each calendar
```bash
# Test Command
curl -s "http://localhost:3001/events?calendar=home" | jq '.[] | .title' | wc -l
curl -s "http://localhost:3001/events?calendar=work" | jq '.[] | .title' | wc -l
curl -s "http://localhost:3001/events?calendar=shared" | jq '.[] | .title' | wc -l
curl -s "http://localhost:3001/events?calendar=meals" | jq '.[] | .title' | wc -l

# Expected Output:
# Home: 274 events
# Work: 44 events  
# Shared: 1 event
# Meals: 1 event
# PASS: Totals match CalDAV directly
# FAIL: Missing events or wrong counts
```

### 3. DATABASE STORAGE VALIDATION
**Quality Gate**: All events saved with correct calendar metadata
```bash
# Test Command
sqlite3 data/calendar.db "SELECT calendar_name, COUNT(*) FROM events GROUP BY calendar_name;"
# Expected Output:
# home|274
# work|44
# shared|1
# meals|1
# PASS: All events stored with calendar_name
# FAIL: Missing calendar_name or wrong counts
```

### 4. FILENAME MAPPING VALIDATION
**Quality Gate**: All events have caldav_filename stored
```bash
# Test Command
sqlite3 data/calendar.db "SELECT COUNT(*) FROM events WHERE caldav_filename IS NULL;"
# Expected Output: 0
# PASS: All events have filename mapping
# FAIL: Any NULL caldav_filename values
```

### 5. CRUD OPERATIONS PER CALENDAR
**Quality Gate**: Create/Read/Update/Delete works on each calendar

#### CREATE Test
```bash
# Test each calendar
curl -X POST "http://localhost:3001/events?calendar=home" -d '{"title":"Test Home Event","date":"2025-08-20"}'
curl -X POST "http://localhost:3001/events?calendar=work" -d '{"title":"Test Work Event","date":"2025-08-20"}'
curl -X POST "http://localhost:3001/events?calendar=meals" -d '{"title":"Test Meal Event","date":"2025-08-20"}'

# Verify in CalDAV
./get_all_caldav_events.sh | grep "Test.*Event"
# PASS: All 3 test events appear in correct calendars
# FAIL: Events missing or in wrong calendar
```

#### READ Test
```bash
# Test calendar filtering
curl "http://localhost:3001/events?calendar=home" | jq '.[] | select(.title | contains("Test Home"))'
# PASS: Returns only home calendar events
# FAIL: Returns events from other calendars
```

#### UPDATE Test
```bash
# Get event ID, update it
EVENT_ID=$(curl "http://localhost:3001/events?calendar=home" | jq -r '.[] | select(.title | contains("Test Home")) | .id')
curl -X PUT "http://localhost:3001/events/${EVENT_ID}?calendar=home" -d '{"title":"Updated Home Event"}'

# Verify in CalDAV
./get_all_caldav_events.sh | grep "Updated Home Event"
# PASS: Event updated in correct calendar
# FAIL: Update failed or in wrong calendar
```

#### DELETE Test
```bash
# Delete test events
curl -X DELETE "http://localhost:3001/events/${EVENT_ID}?calendar=home"

# Verify removal from CalDAV
./get_all_caldav_events.sh | grep "Updated Home Event"
# PASS: Event deleted from CalDAV
# FAIL: Event still exists in CalDAV
```

### 6. COMPREHENSIVE INTEGRATION TEST
**Quality Gate**: Full workflow works end-to-end
```bash
# Full test script
#!/bin/bash
echo "=== TESTING ALL CALENDARS ==="

# 1. Calendar Discovery
./get_all_caldav_events.sh > /tmp/caldav_state.txt
TOTAL_EVENTS=$(grep "Events found:" /tmp/caldav_state.txt | awk '{sum+=$3} END {print sum}')
echo "Total CalDAV events: $TOTAL_EVENTS"

# 2. API Event Counts
HOME_COUNT=$(curl -s "http://localhost:3001/events?calendar=home" | jq '. | length')
WORK_COUNT=$(curl -s "http://localhost:3001/events?calendar=work" | jq '. | length')
SHARED_COUNT=$(curl -s "http://localhost:3001/events?calendar=shared" | jq '. | length')
MEALS_COUNT=$(curl -s "http://localhost:3001/events?calendar=meals" | jq '. | length')
API_TOTAL=$((HOME_COUNT + WORK_COUNT + SHARED_COUNT + MEALS_COUNT))
echo "Total API events: $API_TOTAL"

# 3. Database Event Counts  
DB_TOTAL=$(sqlite3 data/calendar.db "SELECT COUNT(*) FROM events WHERE deleted_at IS NULL;")
echo "Total DB events: $DB_TOTAL"

# PASS: All three totals match (320 events)
# FAIL: Any mismatch between CalDAV, API, and Database
if [ "$TOTAL_EVENTS" -eq "$API_TOTAL" ] && [ "$API_TOTAL" -eq "$DB_TOTAL" ]; then
    echo "✅ PASS: All event counts match"
else
    echo "❌ FAIL: Event count mismatch"
    exit 1
fi
```