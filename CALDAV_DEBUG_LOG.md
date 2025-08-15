# CalDAV Event Editing Debug Log

## Problem Summary
Attempting to implement event editing using delete-then-create approach for Apple iCloud CalDAV. Delete operation succeeds but create operation fails with 400 Bad Request.

## Implementation Approach: Delete-Then-Create
**Why this approach?**: Apple CalDAV PUT updates are complex, requiring exact URL matching, ETags, etc. Delete-then-create is a common pattern used by many CalDAV clients (Thunderbird, Evolution).

## Current Status: DELETE ✅ | CREATE ❌

### DELETE Operation - WORKING
```
Method: DELETE
URL: https://p36-caldav.icloud.com:443/1110188709/calendars/home/test-event-%24(date%20%2B%25s)%40example.com.ics
Response: 404 Not Found (treated as success - already deleted)
```

### CREATE Operation - FAILING  
```
Method: PUT
URL: https://p36-caldav.icloud.com:443/1110188709/calendars/home/test-event-date-%s-example.com-1755295979672.ics
Response: 400 Bad Request
Headers: 
  - Authorization: Basic [credentials]
  - Content-Type: text/calendar; charset=utf-8
  - User-Agent: Swanson-Light-Calendar/1.0
Body: iCalendar VEVENT data
```

## Troubleshooting History

### Issue 1: Express Router URL Decoding ✅ FIXED
**Problem**: Event ID `test-event-$(date +%s)@example.com` caused Express router errors
**Solution**: Base64 encode event ID for API routes, decode in controller
**Status**: Fixed - router no longer crashes

### Issue 2: CalDAV URL Special Characters ✅ FIXED  
**Problem**: Raw event ID with `$()@` characters caused `ERR_UNESCAPED_CHARACTERS` in HTTP requests
**Solution**: URL-encode event IDs in CalDAV repository calls
**Status**: Fixed - HTTP requests no longer fail due to special chars

### Issue 3: CalDAV 412 Precondition Failed ✅ FIXED
**Problem**: `If-None-Match: *` header caused 412 errors
**Solution**: Removed `If-None-Match` header based on Apple CalDAV docs
**Result**: Error changed from 412 → 400 (progress!)

### Issue 4: iCalendar Format for Apple CalDAV ❌ STILL FAILING
**Problem**: 400 Bad Request on event creation
**Research Done**: 
- Apple requires UTC format with Z suffix (YYYYMMDDTHHMMSSZ)
- No timezone offsets allowed  
- Seconds must be included
- No separators in date/time components

**Current iCalendar Output**:
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Swanson Light Calendar//EN
BEGIN:VEVENT
UID:test-event-$(date +%s)@example.com
DTSTAMP:20250815T221259Z
DTSTART:20250816T173000Z
SUMMARY:EDITED: Test Event Via Delete-Create FINAL
DESCRIPTION:Testing CalDAV event editing with proper Apple UTC format
SEQUENCE:0
LAST-MODIFIED:20250815T221259Z
END:VEVENT
END:VCALENDAR
```

## Current Error Details
```
HTTP/1.1 400 Bad Request
Server: AppleHttpServer/7347b443149f
Content-Type: text/html
Body: <html><head><title>400 Bad Request</title></head><body><center><h1>400 Bad Request</h1></center><hr><center>AppleHttpServer/7347b443149f</center></body></html>
```

## What We Need Help With

1. **iCalendar Format Validation**: Is our VEVENT format correct for Apple CalDAV?
   - Are we missing required properties?
   - Is the UID format acceptable?
   - Should we include DTEND instead of just DTSTART?

2. **Apple CalDAV Specifics**: 
   - Are there additional headers required?
   - Is the filename format correct? (using cleaned event ID + timestamp)
   - Any Apple-specific iCalendar extensions needed?

3. **Alternative Approaches**: 
   - Should we try MKCALEDAR first?
   - Different authentication method?
   - Different Content-Type?

## Test Environment
- **Server**: TypeScript/Express backend
- **CalDAV Target**: Apple iCloud (p36-caldav.icloud.com)
- **Authentication**: Basic auth with app-specific password
- **Event ID**: `test-event-$(date +%s)@example.com` (problematic due to special chars)

## Reproducible Test Case
```bash
# Base64 encode the event ID
ENCODED_ID=$(echo -n "test-event-\$(date +%s)@example.com" | base64 | tr '+/' '-_' | tr -d '=')

# Test the update endpoint
curl -X PUT "http://localhost:3001/events/$ENCODED_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-event-$(date +%s)@example.com",
    "title": "EDITED: Test Event",
    "date": "2025-08-16T06:00:00.000Z",
    "time": "11:30",
    "description": "Testing CalDAV event editing"
  }'
```

## Next Steps Needed
1. **iCalendar Format Expert Review**: Need someone familiar with Apple CalDAV requirements
2. **Working Example**: Find a confirmed working iCalendar format for Apple CalDAV
3. **Alternative Strategy**: Consider if we should abandon delete-then-create and fix direct PUT updates instead

**Last Updated**: 2025-08-15 22:13 UTC
**Status**: DELETE working, CREATE failing with 400 Bad Request