# Bidirectional Sync System - Complete Documentation

## Overview
The Swanson Light calendar system maintains perfect synchronization between three components:
- **React Web App** (http://localhost:3000) - User interface
- **SQLite Database** (./data/calendar.db) - Local cache and source of truth
- **Apple CalDAV Server** (iCloud SHARED calendar) - Cloud storage for family access

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  React App  │ <-> │   SQLite     │ <-> │  Apple CalDAV   │
│   (UI)      │     │  Database    │     │ SHARED Calendar │
└─────────────┘     └──────────────┘     └─────────────────┘
      ↓                    ↓                      ↓
   User Actions      Local Storage          Family Devices
                   (with deletion tracking)
```

## Key Components

### 1. Database Schema

#### Events Table
```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  -- ... metadata fields ...
  sync_status TEXT,        -- 'pending' or 'synced'
  local_modified TEXT,      -- Timestamp of local modification
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

#### Deleted Events Tracking Table
```sql
CREATE TABLE deleted_events (
  id TEXT PRIMARY KEY,
  deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  synced_to_caldav BOOLEAN DEFAULT 0
)
```

### 2. Sync Operations

#### Create Event Flow
```
User creates event → SQLite (sync_status='pending') → Background sync → CalDAV → Family devices
```

#### Update Event Flow
```
User edits event → SQLite (sync_status='pending') → Background sync → Delete from CalDAV → Recreate in CalDAV
```

#### Delete Event Flow (NEW - FIXED)
```
User deletes event → SQLite DELETE + Track in deleted_events → Sync → Delete from CalDAV → Mark synced
```

#### Sync Button Flow
```
User clicks sync → 
1. Sync deletions to CalDAV
2. Fetch all CalDAV events
3. Filter out locally deleted events (smart sync)
4. Update SQLite with remaining events
5. Clean up old deletion records
```

## Critical Fix: Deletion Tracking System

### Problem We Solved
Previously, when an event was deleted locally and then "Sync with Apple Calendar" was clicked, the deleted event would reappear because the sync would fetch it from CalDAV and restore it.

### Solution Implemented
1. **Deletion Tracking**: When an event is deleted, we:
   - Remove it from the `events` table
   - Add its ID to `deleted_events` table with `synced_to_caldav=0`

2. **Smart Sync**: During sync from CalDAV, we:
   - Check each incoming event against `deleted_events` table
   - Skip events that were deleted locally
   - Prevent deleted events from being restored

3. **Deletion Propagation**: During sync, we:
   - Find all deletions with `synced_to_caldav=0`
   - Delete them from CalDAV
   - Mark them as `synced_to_caldav=1`

### Code Implementation

#### SQLiteRepository.ts - Key Methods
```typescript
// Track deletion when deleting an event
async deleteEvent(eventId: string): Promise<boolean> {
  // Transaction: DELETE from events + INSERT into deleted_events
}

// Check if event was deleted locally
async isEventDeleted(eventId: string): Promise<boolean> {
  // Query deleted_events table
}

// Smart sync that filters deleted events
async saveEventsWithSmartSync(events: CalendarEvent[]): Promise<void> {
  // Filter out locally deleted events before saving
}
```

#### DatabaseCalendarService.ts - Sync Logic
```typescript
async forceSync(): Promise<void> {
  // 1. Sync deletions to CalDAV first
  await this.syncDeletionsToCalDAV();
  
  // 2. Fetch from CalDAV
  const events = await this.calDAVRepository.fetchCalendarData();
  
  // 3. Smart sync (filters deleted events)
  await this.sqliteRepository.saveEventsWithSmartSync(events);
  
  // 4. Cleanup old records
  await this.sqliteRepository.cleanupDeletedEvents();
}
```

## Testing Verification

### Test Case 1: Delete via Web Interface
1. Click event in calendar
2. Click "Delete" button
3. Confirm deletion
4. Event disappears from UI ✓
5. Check database: Event removed from `events` table ✓
6. Check database: Event tracked in `deleted_events` table ✓

### Test Case 2: Sync After Deletion
1. Delete event locally
2. Click "Sync with Apple Calendar"
3. Event stays deleted (doesn't reappear) ✓
4. Event deleted from CalDAV ✓
5. Deletion marked as synced ✓

### Test Case 3: Cross-Device Sync
1. Delete event on web app
2. Sync with Apple Calendar
3. Check iPhone calendar - event is gone ✓
4. Add event on iPhone
5. Sync on web app - new event appears ✓

## API Endpoints

### Event Management
- `GET /events` - Fetch all events from SQLite
- `POST /events` - Create new event (marks as pending sync)
- `PUT /events/:id` - Update event (marks as pending sync)
- `DELETE /events/:id` - Delete event (tracks deletion)

### Sync Operations
- `POST /admin/sync` - Force bidirectional sync

## Environment Configuration

### CalDAV Settings (CalDAVConfig.ts)
```typescript
{
  hostname: 'p36-caldav.icloud.com',
  path: '/1110188709/calendars/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/',
  // SHARED calendar - only one that accepts writes
}
```

## Maintenance

### Cleanup Operations
- Deleted events older than 30 days are automatically cleaned up
- Events older than 6 months are removed during sync
- Deletion tracking records are preserved for 30 days

### Monitoring
Check sync status in server logs:
```bash
# Watch for sync operations
tail -f server.log | grep -E "sync|delete"

# Check deletion tracking
sqlite3 data/calendar.db "SELECT * FROM deleted_events;"

# Verify event counts
sqlite3 data/calendar.db "SELECT COUNT(*) FROM events;"
```

## Troubleshooting

### Issue: Deleted events reappearing
**Solution**: Implemented deletion tracking system (FIXED)

### Issue: CalDAV returns 500 error
**Cause**: Using wrong calendar (Home/Work instead of SHARED)
**Solution**: Use SHARED calendar ID

### Issue: Events not syncing to iPhone
**Cause**: Not using family SHARED calendar
**Solution**: Ensure using calendar ID `2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E`

## Future Improvements
- [ ] Add conflict resolution for simultaneous edits
- [ ] Implement real-time sync via WebSockets
- [ ] Add sync status indicator in UI
- [ ] Track modification history for events
- [ ] Add undo functionality for deletions