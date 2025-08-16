# CalDAV Bidirectional Sync - SHARED Calendar Documentation

## 🔄 Bidirectional Sync Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   SQLite    │ <-> │   Sync       │ <-> │  Apple CalDAV   │
│  Database   │     │   Service    │     │ SHARED Calendar │
└─────────────┘     └──────────────┘     └─────────────────┘
      ↑                                           ↑
      │                                           │
  Local Events                               Family Devices
   (Instant)                                (iPhone/iPad)
```

## Critical Issues Found and Fixed

### 1. Using SHARED Calendar (Not Home) ✅

**Discovery:** Only SHARED calendar accepts PUT requests for creating events
**Calendar ID:** `2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E`
**Path:** `/1110188709/calendars/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/`
**Why it works:** SHARED calendars have write permissions for CalDAV operations

### Available Calendars Discovered:

```bash
curl -X PROPFIND https://p36-caldav.icloud.com/1110188709/calendars/ \
  -H "Depth: 1" | grep displayname

# Results:
# - Home (/calendars/home/) - 500 Error on PUT ❌
# - Work (/calendars/work/) - 500 Error on PUT ❌
# - Shared (2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E) - 201 Created ✅
# - Meals (1fa1e4097e27af6d41607163c20c088e70cf8e9db9d71b1a62611ec364123914) - Shared
```

### 2. sync_status Database Bug ❌ → ✅

**Problem:** New events were automatically marked as 'synced' due to DEFAULT value in database
**Solution:** Modified INSERT statement to explicitly set sync_status = 'pending'
**File:** `/server-src/repositories/SQLiteRepository.ts`
**Fix:** Added sync_status and local_modified to INSERT columns and values

### 3. Column Mismatch in preserveMetadata Query ❌ → ✅

**Problem:** INSERT statement had 24 columns but 26 values were being passed
**Solution:** Added missing sync_status and local_modified columns to both INSERT queries

## Verification Process

### Check Event Creation Works

```bash
# Create event
curl -X POST http://localhost:3001/events \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Event","date":"2025-08-22T14:00:00.000Z","time":"14:00"}'

# Check it's pending in database
sqlite3 data/calendar.db "SELECT sync_status FROM events WHERE title='Test Event'"

# Should return: pending (not synced!)
```

### Verify CalDAV Sync

```bash
# Watch server logs - should see:
# - "Found 1 pending events to sync"
# - "=== CalDAV CREATE Response === Status: 201 Created"
# - "Event XXX synced to CalDAV successfully"
```

### Confirm Event in CalDAV

```bash
# Direct GET to CalDAV (replace filename from logs)
curl -X GET "https://p36-caldav.icloud.com/1110188709/calendars/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/[filename].ics" \
  -H "Authorization: Basic [base64_auth]"
```

## 🎯 Current Status - Bidirectional Sync Working!

✅ **LOCAL → CALDAV SYNC**

- Create event via API → Saved to SQLite with `sync_status='pending'`
- Background sync picks up pending events
- Syncs to Apple CalDAV SHARED calendar
- Appears on all family iPhones/iPads

✅ **CALDAV → LOCAL SYNC**

- Force sync endpoint pulls all CalDAV events
- Merges with local database
- Preserves local metadata
- Available instantly via API

## 🔄 Sync Flow Details

### Creating Events (Local → CalDAV)

```
POST /events → SQLite (pending) → Background Sync → CalDAV SHARED → Family Devices
```

### Fetching Events (CalDAV → Local)

```
CalDAV SHARED → REPORT Query → Parse iCal → SQLite Merge → GET /events
```

### Bidirectional Sync Points

1. **On Event Creation**: Immediate background sync to CalDAV
2. **On Force Sync**: Pull all CalDAV events to local
3. **On App Start**: Initial sync from CalDAV
4. **Manual Sync Button**: Triggers full bidirectional sync

## 👨‍👩‍👧‍👦 Family Calendar Benefits

Using SHARED calendar (`2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E`) provides:

- **Family Visibility**: All family members see same events
- **Collaborative Editing**: Everyone can add/modify events
- **TODO Management**: Rich metadata for task tracking
- **Instant Sync**: Changes appear on all devices within minutes
- **Offline Support**: SQLite cache works without internet

## Key Files Changed

1. `/server-src/config/CalDAVConfig.ts` - Updated calendar path
2. `/server-src/repositories/SQLiteRepository.ts` - Fixed INSERT statements
3. `/server-src/services/DatabaseCalendarService.ts` - Simplified sync logic

## 📋 TODO Metadata Support

The bidirectional sync preserves all CalDAV metadata fields perfect for TODO tracking:

```javascript
// Example TODO Event
{
  "title": "TODO: Buy groceries",
  "categories": ["todo", "shopping"],
  "priority": 2,
  "status": "CONFIRMED",  // CANCELLED when completed
  "description": "[ ] Milk\n[x] Bread\n[ ] Chips",
  "attendees": ["dad@family.com", "mom@family.com"],
  "location": "Whole Foods"
}
```

## Next Steps

1. Monitor iPhone calendar app for new events
2. Test TODO metadata sync between devices
3. Set up family member access to SHARED calendar
