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
│   └── CalendarService.ts  
├── repositories/        # Data access ONLY
│   └── CalDAVRepository.ts
├── types/              # Shared interfaces
│   └── Calendar.ts
├── config/             # Configuration
│   └── CalDAVConfig.ts
└── server.ts           # Dependency injection
```

### File Responsibilities

**CalendarController.ts** (20 lines per method max)
- HTTP request/response handling
- Query parameter parsing
- Response formatting
- Error HTTP status codes
- NO business logic

**CalendarService.ts** (3-5 public methods max)
- Event filtering logic
- Date range calculations
- Business rule validation
- Event transformation
- NO data access, NO HTTP

**CalDAVRepository.ts** (Single responsibility)
- CalDAV protocol communication
- XML parsing and generation
- Network error handling
- Raw data transformation
- NO business logic

**Calendar.ts** (Interface definitions)
- Event data structure
- Configuration interfaces
- Type definitions only
- NO implementation

## 🔧 Development Workflow

### Adding New Features

1. **Define Types** in `Calendar.ts`
2. **Add Repository Method** for data access
3. **Add Service Method** for business logic
4. **Add Controller Method** for HTTP handling
5. **Register Route** in `server.ts`
6. **Add Tests** for all layers

### Code Rules

- **One Thing Per File** - If a file does multiple things, split it
- **Max 3-5 public methods** per service
- **Max 20-30 lines** per method
- **No circular dependencies** between features
- **Explicit over implicit** - boring code over smart code

## 📊 CalDAV Integration Details

### Event Data Fields Extracted

**Core Fields (Required)**
- `id` - Event UID from CalDAV
- `title` - Event summary
- `date` - Start date (ISO 8601)
- `time` - Formatted start time

**Rich Fields (Optional)**
- `description` - Event notes/body
- `location` - Physical/virtual location
- `organizer` - Event organizer email
- `attendees[]` - List of participant emails
- `categories[]` - Event tags/labels
- `priority` - Importance level (1-9)
- `status` - CONFIRMED/TENTATIVE/CANCELLED
- `visibility` - PUBLIC/PRIVATE/CONFIDENTIAL
- `dtend` - End date (ISO 8601)
- `duration` - Duration in ISO 8601 format
- `rrule` - Recurrence rule
- `created` - Creation timestamp
- `lastModified` - Last update timestamp
- `sequence` - Version number
- `url` - Related web link
- `geo` - GPS coordinates {lat, lon}
- `transparency` - OPAQUE/TRANSPARENT
- `attachments[]` - File attachments
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
     async fetchCalendarData(start?: Date, end?: Date): Promise<string>
     parseCalendarEvents(data: string): CalendarEvent[]
   }
   ```

2. **Update Service**
   ```typescript
   constructor(private repository: CalDAVRepository | GoogleCalendarRepository)
   ```

3. **Update Configuration**
   ```typescript
   interface CalendarConfig {
     provider: 'caldav' | 'google'
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
   const cachedRepo = new CachedCalDAVRepository(calDAVRepo, redis)
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
console.log('CalDAVRepository.fetchCalendarData:', { xmlResponse: data.length });

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