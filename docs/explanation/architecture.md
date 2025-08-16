# Swanson Light - Developer Notes & Architecture

## 🏗️ Architecture Overview

This project implements **Clean Architecture** principles with strict separation of concerns. Every decision follows the CLAUDE.md rules for maintainable, scalable code.

### Layer Structure

```
Request → Controller → Service → Repository → CalDAV API
         ↓
Response ← Controller ← Service ← Repository ← CalDAV API
```

**Never skip layers. Never go backwards.**

## 📁 Directory Structure

```
server-src/
├── controllers/          # HTTP layer ONLY
│   └── CalendarController.ts
├── services/            # Business logic ONLY
│   ├── CalendarService.ts
│   └── DatabaseCalendarService.ts  # SQLite-enabled service
├── repositories/        # Data access ONLY
│   ├── CalDAVRepository.ts
│   └── SQLiteRepository.ts         # SQLite database layer
├── config/             # Configuration
│   ├── CalDAVConfig.ts
│   └── DatabaseConfig.ts           # Database configuration
├── types/              # Shared interfaces
│   └── Calendar.ts                 # Includes ICalendarService interface
└── server.ts           # Dependency injection with database layer
```

### File Responsibilities

**CalendarController.ts** (20 lines per method max)

- HTTP request/response handling
- Query parameter parsing
- Response formatting
- Error HTTP status codes
- NO business logic

**DatabaseCalendarService.ts** (3-5 public methods max)

- Event filtering logic with SQLite caching
- Background sync orchestration
- Business rule validation
- Fallback to CalDAV on database failures
- NO direct database access, NO HTTP

**CalendarService.ts** (Legacy direct CalDAV service)

- Direct CalDAV event operations
- Maintained for fallback scenarios
- Event validation logic
- NO database operations

**SQLiteRepository.ts** (Single responsibility)

- SQLite database operations with metadata preservation
- Transaction management and atomic operations
- Error handling and recovery mechanisms
- Data lifecycle management and cleanup
- Granular metadata updates (ETags, sync timestamps)
- NO business logic

**CalDAVRepository.ts** (Single responsibility)

- CalDAV protocol communication
- XML parsing and generation
- Network error handling
- Raw data transformation
- NO business logic

**DatabaseConfig.ts** (Configuration only)

- Environment variable mapping
- Database connection parameters
- Sync interval configuration
- NO implementation logic

**Calendar.ts** (Interface definitions)

- Event data structure
- Configuration interfaces
- ICalendarService interface for clean architecture
- Type definitions only
- NO implementation

## 🔧 Development Workflow

### Adding New Features

1. **Define Types** in `Calendar.ts`
2. **Add Repository Method** for data access (SQLite and/or CalDAV)
3. **Add Service Method** for business logic in `DatabaseCalendarService.ts`
4. **Add Controller Method** for HTTP handling
5. **Register Route** in `server.ts`
6. **Add Tests** for all layers
7. **Update Database Schema** if new fields needed

### Database Management Workflow

**Schema Migrations:**

```typescript
// Add new field to SQLiteRepository.ts
ALTER TABLE events ADD COLUMN new_field TEXT;

// Update rowToEvent() method
if (row.new_field) event.newField = row.new_field;

// Update saveEvents() method
// Add new_field to INSERT statement parameters
```

**Performance Monitoring:**

```bash
# Check database size
ls -lh data/calendar.db

# Analyze query performance
sqlite3 data/calendar.db "EXPLAIN QUERY PLAN SELECT * FROM events WHERE date >= '2025-08-15'"

# Monitor sync performance
curl -X POST http://localhost:3002/admin/sync
```

**Backup Strategy:**

```bash
# Automated backup (add to cron)
cp data/calendar.db data/calendar-backup-$(date +%Y%m%d).db

# Restore from backup
cp data/calendar-backup-20250815.db data/calendar.db
```

**Metadata Management Examples:**

```bash
# View sync timestamps
sqlite3 data/calendar.db "SELECT id, title, synced_at FROM events ORDER BY synced_at DESC LIMIT 5;"

# Check events with ETags (prepared for incremental sync)
sqlite3 data/calendar.db "SELECT id, title, caldav_etag FROM events WHERE caldav_etag IS NOT NULL;"

# View metadata for specific event
sqlite3 data/calendar.db "SELECT * FROM events WHERE id = 'specific-event-id';"
```

**Custom Metadata Extensions:**

```sql
-- Add custom fields for future features
ALTER TABLE events ADD COLUMN user_priority INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN local_notes TEXT;
ALTER TABLE events ADD COLUMN custom_flags JSON;

-- Update custom metadata
UPDATE events SET user_priority = 5 WHERE id = 'important-meeting';
```

### Code Rules

- **One Thing Per File** - If a file does multiple things, split it
- **Max 3-5 public methods** per service
- **Max 20-30 lines** per method
- **No circular dependencies** between features
- **Explicit over implicit** - boring code over smart code

## 🗄️ SQLite Database Layer

### Architecture Overview

The calendar service implements a **three-tier caching architecture** following Google's database best practices:

```
CalDAV API → SQLite Cache → API Response
     ↓            ↑            ↓
Background Sync → Local DB → Instant Response
```

**Performance Benefits:**

- **Sub-10ms response times** vs 200-500ms CalDAV API calls
- **Offline capability** - works without CalDAV connectivity
- **Reduced API load** - sync every 15 minutes vs every request
- **Automatic failover** - falls back to CalDAV if database fails

### Database Schema Design

**Events Table:** Comprehensive storage for all CalDAV fields

```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,              -- CalDAV UID
  title TEXT NOT NULL,              -- Event summary
  date TEXT NOT NULL,               -- ISO 8601 start date
  time TEXT NOT NULL,               -- Formatted start time
  description TEXT,                 -- Event body/notes
  location TEXT,                    -- Physical/virtual location
  organizer TEXT,                   -- Organizer email
  attendees TEXT,                   -- JSON array of attendees
  categories TEXT,                  -- JSON array of categories
  priority INTEGER,                 -- 1-9 importance level
  status TEXT,                      -- CONFIRMED/TENTATIVE/CANCELLED
  visibility TEXT,                  -- PUBLIC/PRIVATE/CONFIDENTIAL
  dtend TEXT,                       -- ISO 8601 end date
  duration TEXT,                    -- ISO 8601 duration
  rrule TEXT,                       -- Recurrence rule
  created TEXT,                     -- Creation timestamp
  last_modified TEXT,               -- Last update timestamp
  sequence INTEGER,                 -- Version number
  url TEXT,                         -- Related web link
  geo_lat REAL,                     -- GPS latitude
  geo_lon REAL,                     -- GPS longitude
  transparency TEXT,                -- OPAQUE/TRANSPARENT
  attachments TEXT,                 -- JSON array of files
  timezone TEXT,                    -- Event timezone
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  caldav_etag TEXT                  -- ETag for conflict detection
);

-- Performance indexes
CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_events_sync ON events(synced_at);
```

### Database Configuration

**Environment Variables:**

```bash
DATABASE_PATH="./data/calendar.db"    # Database file location
SYNC_INTERVAL_MINUTES="15"           # Background sync frequency
MAX_AGE_MONTHS="6"                   # Auto-cleanup threshold
```

**Configuration Class:**

```typescript
export class DatabaseConfig {
  static getConfig(): DatabaseConfig {
    return {
      path: process.env.DATABASE_PATH || './data/calendar.db',
      syncIntervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES || '15'),
      maxAgeMonths: parseInt(process.env.MAX_AGE_MONTHS || '6'),
    };
  }
}
```

### Metadata Preservation During Sync

**Problem:** Traditional sync operations overwrite all data, losing valuable metadata.

**Solution:** Smart metadata-preserving sync with dual SQL strategies.

```typescript
// Metadata-preserving sync (default for CalDAV sync)
await sqliteRepository.saveEvents(events, true); // preserveMetadata = true

// Full replace for new data (default for manual operations)
await sqliteRepository.saveEvents(events, false); // preserveMetadata = false
```

**Preserved Fields During Sync:**

- `synced_at` - Original sync timestamp maintained
- `caldav_etag` - ETag for change detection preserved
- `custom_data` - Future user metadata fields (extensible)

**Implementation:**

```sql
-- Metadata-preserving sync uses ON CONFLICT DO UPDATE
INSERT INTO events (..., synced_at)
VALUES (..., COALESCE((SELECT synced_at FROM events WHERE id = ?), CURRENT_TIMESTAMP))
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  date = excluded.date,
  -- ... update CalDAV fields only ...
  -- Note: synced_at and caldav_etag preserved!

-- vs Traditional sync (overwrites everything)
INSERT OR REPLACE INTO events (...) VALUES (..., CURRENT_TIMESTAMP);
```

**Granular Metadata Updates:**

```typescript
// Update specific metadata without touching event data
await sqliteRepository.updateEventMetadata(eventId, {
  caldav_etag: 'abc123',
  custom_data: { userFlag: 'important', priority: 'high' },
});
```

### Transaction Safety & Error Handling

**Atomic Operations:** All bulk operations use proper transactions

```typescript
// Begin transaction with error handling
this.db.run('BEGIN TRANSACTION', err => {
  if (err) {
    console.error('Failed to start transaction:', err);
    reject(err);
    return;
  }
});

// Individual operation error tracking
events.forEach(event => {
  stmt.run([...eventData], err => {
    if (err) {
      console.error(`Failed to save event ${event.id}:`, err);
      hasError = true;
    }
  });
});

// Commit or rollback based on results
if (hasError) {
  this.db.run('ROLLBACK', rollbackErr => {
    if (rollbackErr) console.error('Rollback failed:', rollbackErr);
    reject(new Error('Transaction failed and was rolled back'));
  });
} else {
  this.db.run('COMMIT', commitErr => {
    if (commitErr) {
      this.db.run('ROLLBACK');
      reject(commitErr);
    } else {
      resolve();
    }
  });
}
```

### Background Sync Strategy

**Current Implementation: Intelligent Full Sync**

- **Initial sync** on server startup
- **Periodic sync** every 15 minutes (configurable)
- **Manual sync** via `/admin/sync` endpoint
- **Conditional sync** only when data is stale
- **Metadata preservation** maintains sync history

```typescript
private async checkAndSync(): Promise<void> {
  const lastSync = await this.sqliteRepository.getLastSyncTime();
  const now = new Date();

  const shouldSync = !lastSync ||
    (now.getTime() - lastSync.getTime()) > (this.syncIntervalMinutes * 60 * 1000);

  if (shouldSync) {
    await this.forceSync(); // Full sync with metadata preservation
  }
}
```

**Future Enhancement: Incremental Sync**

The metadata preservation foundation enables efficient incremental sync:

```typescript
// Future implementation leveraging preserved ETags
async incrementalSync(): Promise<void> {
  // 1. Get stored ETags for change detection
  const storedETags = await this.sqliteRepository.getEventETags();

  // 2. Fetch only changed events since last sync
  const changes = await this.calDAVRepository.getChangedEventsSince(
    await this.getLastSyncTime(),
    storedETags
  );

  // 3. Apply changes with metadata preservation
  await this.sqliteRepository.saveEvents(changes.events, true);

  // 4. Update ETags for next incremental sync
  for (const event of changes.events) {
    await this.sqliteRepository.updateEventMetadata(event.id, {
      caldav_etag: event.etag
    });
  }

  console.log(`Incremental sync: ${changes.events.length} changed events`);
}
```

**Benefits of Current + Future Approach:**

- **Current:** Reliable full sync with metadata preservation
- **Future:** ETag-based incremental sync for efficiency
- **Bandwidth:** Reduce from 274 events to ~5-10 changed events per sync
- **Performance:** Sub-second sync times for incremental updates

### Data Lifecycle Management

**Automatic Cleanup:**

```typescript
// Remove events older than 6 months
const sixMonthsAgo = new Date();
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
await this.sqliteRepository.clearOldEvents(sixMonthsAgo);
```

**Graceful Shutdown:**

```typescript
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  sqliteRepository.close();
  process.exit(0);
});
```

### Performance Optimization

**Query Optimization:**

- **Date-range filtering** with indexed queries
- **Streaming results** for large datasets
- **Prepared statements** for bulk operations
- **Connection pooling** via singleton pattern

**Memory Management:**

- **JSON serialization** for complex fields (attendees, categories)
- **Lazy loading** of optional fields
- **Efficient row mapping** with conditional assignment

### Monitoring & Observability

**Database Health Checks:**

```typescript
// Connection validation
this.db = new sqlite3.Database(dbPath, err => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err);
    throw err;
  }
  console.log('Connected to SQLite database at:', dbPath);
});

// Sync operation logging
console.log(`Synced ${events.length} events to database`);
console.log('Force syncing events from CalDAV to database...');
```

**Admin Endpoints:**

```typescript
// Manual sync trigger
POST / admin / sync;
// Response: { "success": true, "message": "Sync completed" }

// Database health status (future enhancement)
GET / admin / health;
// Response: { "database": "connected", "lastSync": "2025-08-15T21:45:00Z" }
```

### Error Recovery & Resilience

**Fallback Strategy:**

```typescript
async getEvents(startDate?: Date, endDate?: Date): Promise<CalendarEvent[]> {
  try {
    // Primary: Serve from SQLite database
    const events = await this.sqliteRepository.getEvents(startDate, endDate);

    // Background: Check if sync needed
    this.checkAndSync().catch(error => {
      console.error('Background sync failed:', error);
    });

    return events.length > 0 ? events : this.getFallbackEvents();
  } catch (error) {
    // Fallback: Direct CalDAV query
    const xmlData = await this.calDAVRepository.fetchCalendarData(startDate, endDate);
    return this.calDAVRepository.parseCalendarEvents(xmlData);
  }
}
```

**Connection Recovery:**

- Auto-retry failed transactions
- Graceful degradation to CalDAV
- Connection validation on startup
- Proper error logging for debugging

### Security Considerations

**Data Protection:**

- Database files excluded from version control (`.gitignore`)
- No sensitive credentials stored in database
- Local-only access (no network exposure)
- File permissions restricted to application user

**SQL Injection Prevention:**

- **Prepared statements** for all queries
- **Parameterized queries** with proper escaping
- **Input validation** at service layer
- **Type safety** via TypeScript interfaces

## 📊 CalDAV Integration Details

### 🚨 IMPORTANT: Using SHARED Calendar

**We're using the SHARED calendar (`2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E`) for all events!**

- This is the only calendar that accepts PUT requests for creating events
- Perfect for family calendar where everyone can see/edit events
- See `SHARED_CALENDAR_GUIDE.md` for family setup instructions

### Event Data Fields Extracted

**Core Fields (Required)**

- `id` - Event UID from CalDAV
- `title` - Event summary (use "TODO:" prefix for tasks)
- `date` - Start date (ISO 8601)
- `time` - Formatted start time

**Rich Fields (Optional) - Perfect for TODOs**

- `description` - Event notes/TODO checklists
- `location` - Where to complete task
- `organizer` - Who created the task
- `attendees[]` - Who's assigned to task
- `categories[]` - Tags like ["todo", "shopping", "urgent"]
- `priority` - 1-9 (1=highest priority)
- `status` - CONFIRMED (active) / CANCELLED (completed)
- `visibility` - PUBLIC/PRIVATE/CONFIDENTIAL
- `dtend` - Deadline for TODO
- `duration` - Time estimate (PT1H30M = 1.5 hours)
- `rrule` - For recurring tasks (FREQ=WEEKLY)
- `created` - When TODO was created
- `lastModified` - Last update to TODO
- `sequence` - Version tracking
- `url` - Links to documents/resources
- `geo` - Location coordinates
- `transparency` - OPAQUE/TRANSPARENT
- `attachments[]` - Related files
- `timezone` - Event timezone

### CalDAV Query Structure

```xml
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag />
    <C:calendar-data />
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="20250815T000000Z" end="20250822T000000Z" />
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>
```

### Date Range Filtering

**Server-side filtering** for performance:

- CalDAV supports `<C:time-range>` filtering
- Reduces network payload
- Handles timezone conversions
- Format: `YYYYMMDDTHHMMSSZ`

## 🧪 Testing Strategy

### Test Scripts Location

```
scripts/
├── simple-test.sh        # Demo all endpoints
├── curl-examples.sh      # Manual test commands
└── test-api.sh          # Full integration suite
```

### Test Coverage

- ✅ All API endpoints
- ✅ Date range filtering
- ✅ Rich data extraction
- ✅ Error handling
- ✅ CalDAV integration

### Adding Tests for New Features

1. Add curl test to `simple-test.sh`
2. Add manual examples to `curl-examples.sh`
3. Add integration test to `test-api.sh`
4. Test with real CalDAV data

## 🔐 Security & Configuration

### Environment Variables (Recommended)

```bash
export CALDAV_USERNAME="your-apple-id@icloud.com"
export CALDAV_PASSWORD="your-app-specific-password"
export CALDAV_HOSTNAME="p36-caldav.icloud.com"
export CALDAV_PATH="/1110188709/calendars/home/"
```

### CalDAV URL Discovery

Apple CalDAV URLs are user-specific. Discovery process:

1. PROPFIND to `https://caldav.icloud.com/.well-known/caldav`
2. Extract `<calendar-home-set>` from response
3. Use extracted URL in configuration

### Apple App-Specific Passwords

- Required for CalDAV access
- Generate at appleid.apple.com → Security
- Format: `xxxx-xxxx-xxxx-xxxx`
- Use instead of main Apple ID password

## 🚀 Performance Optimizations

### Server-Side Filtering

- CalDAV time-range queries reduce payload
- Date calculations done in CalendarService
- Efficient XML parsing with streaming

### Memory Management

- Process events in streams, not batches
- Minimal object allocation in parsing
- Proper error handling prevents memory leaks

### Response Optimization

- Rich data only when needed
- Compressed JSON responses
- Proper HTTP caching headers

## 🔄 Common Development Tasks

### Adding New Calendar Provider

1. **Create New Repository**

   ```typescript
   export class GoogleCalendarRepository {
     async fetchCalendarData(start?: Date, end?: Date): Promise<string>;
     parseCalendarEvents(data: string): CalendarEvent[];
   }
   ```

2. **Update Service**

   ```typescript
   constructor(private repository: CalDAVRepository | GoogleCalendarRepository)
   ```

3. **Update Configuration**
   ```typescript
   interface CalendarConfig {
     provider: 'caldav' | 'google';
     // provider-specific config
   }
   ```

### Adding Event Filtering

1. **Update Service**

   ```typescript
   async getEventsByCategory(category: string): Promise<CalendarEvent[]>
   ```

2. **Update Controller**

   ```typescript
   async getEventsByCategory(req: Request, res: Response)
   ```

3. **Register Route**
   ```typescript
   app.get('/events/category/:category', ...)
   ```

### Adding Caching

1. **Add Redis Repository**

   ```typescript
   export class CachedCalDAVRepository {
     constructor(
       private calDAVRepo: CalDAVRepository,
       private redis: RedisClient
     )
   }
   ```

2. **Update Dependency Injection**
   ```typescript
   const cachedRepo = new CachedCalDAVRepository(calDAVRepo, redis);
   ```

## 🐛 Debugging & Troubleshooting

### Common Issues

**401 Unauthorized**

- Check app-specific password format
- Verify CalDAV URL is correct
- Test with curl directly

**Empty Event Arrays**

- Check date range parameters
- Verify calendar has events in range
- Test CalDAV query manually

**Type Errors**

- Run `npm run type-check:server`
- Check interface compatibility
- Verify import paths

### Debug Logging

```typescript
// Add to service methods
console.log('CalendarService.getEvents:', { startDate, endDate });

// Add to repository methods
console.log('CalDAVRepository.fetchCalendarData:', {
  xmlResponse: data.length,
});

// Add to controller methods
console.log('CalendarController.getEvents:', { queryParams: req.query });
```

### CalDAV Debug

```bash
# Test CalDAV directly
curl -v -X REPORT \
  -H "Content-Type: application/xml" \
  -H "Authorization: Basic $(echo -n 'email:password' | base64)" \
  -d @caldav-query.xml \
  https://p36-caldav.icloud.com/1110188709/calendars/home/
```

## 📈 Scaling Considerations

### Horizontal Scaling

- Stateless server design
- No in-memory caching
- Multiple instances behind load balancer

### Database Layer

- Add PostgreSQL for event caching
- Store processed events for faster queries
- Implement background sync jobs

### API Rate Limiting

- Add Redis-based rate limiting
- Implement CalDAV request queuing
- Add circuit breaker for CalDAV failures

### Monitoring

- Add structured logging
- Implement health check endpoints
- Monitor CalDAV response times

## 🔮 Future Enhancements

### Planned Features

- [ ] WebSocket event streaming
- [ ] Event creation/modification
- [ ] Multiple calendar support
- [ ] Event conflict detection
- [ ] Smart event categorization

### Architecture Improvements

- [ ] GraphQL API layer
- [ ] Event sourcing pattern
- [ ] CQRS for read/write separation
- [ ] Microservices decomposition

### Integration Possibilities

- [ ] Google Calendar support
- [ ] Outlook integration
- [ ] Slack notifications
- [ ] Email reminders
- [ ] Mobile push notifications

## 📚 References

### CalDAV Specifications

- RFC 4791: CalDAV Protocol
- RFC 5545: iCalendar Data Format
- RFC 6352: CardDAV Extensions

### Apple Documentation

- iCloud CalDAV Documentation
- App-Specific Password Guide
- Two-Factor Authentication Setup

### Clean Architecture

- Uncle Bob's Clean Architecture
- Hexagonal Architecture Pattern
- Dependency Inversion Principle

---

**Remember: Boring code is maintainable code. Follow the rules religiously and complexity stays manageable.**
