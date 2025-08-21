# All-Day Event Issue Documentation

## Problem Summary
All-day events created by users are being converted to timed events at 6 AM after CalDAV sync, losing their all-day status.

## Root Cause Analysis

### What Users Enter:
- Date: "2025-08-29"
- Time: "" (empty string, indicating all-day)
- Duration: "PT24H0M" (24 hours)
- Creation Source: "user"

### What Gets Stored in Database After CalDAV Sync:
- Date: "2025-08-29T06:00:00.000Z" 
- Time: "00:00" (midnight local time)
- Duration: "PT24H0M" (still 24 hours)
- Start: "2025-08-29T06:00:00.000Z" (6 AM UTC)
- End: "2025-08-29T07:00:00.000Z" (7 AM UTC, only 1 hour!)
- Timezone: "America/Denver"

### The Issue:
1. **Timezone Conversion Problem**: Midnight in Denver (MT) = 6 AM UTC
2. **iCalendar Format Problem**: All-day events should use DATE format, not DATETIME
3. **CalDAV Interpretation**: Apple CalDAV is treating "00:00" as a timed event, not all-day

## Technical Details

### Current All-Day Detection Logic (should work but doesn't):
```typescript
const isAllDay = !event.time || 
                event.time === '' || 
                event.time === 'All Day' || 
                event.time === 'all day' ||
                event.time === '12:00 AM' ||
                event.time === '00:00' ||
                event.time === '0:00' ||
                event.duration === 'PT24H0M';
```

### Expected iCalendar Format for All-Day Events:
```
DTSTART;VALUE=DATE:20250829
DTEND;VALUE=DATE:20250830
```

### Current iCalendar Format (incorrect for all-day):
```
DTSTART:20250829T000000Z  // This becomes 20250829T060000Z in UTC
DTEND:20250829T010000Z    // End time gets calculated wrong
```

## Data Preservation Fields Added:
- `original_date`: User's exact input
- `original_time`: User's exact input (empty for all-day)
- `original_duration`: User's exact choice
- `creation_source`: 'user' | 'caldav' | 'sync'
- `caldav_processed_at`: When CalDAV last processed

## Debugging Logs Added:
- 📨 CREATE EVENT REQUEST - Raw form data
- 🔍 VALIDATION DEBUG - All field values including originals
- 📅 iCAL GENERATION DEBUG - How event gets converted to iCalendar
- CalDAV sync comparison - Before/after values

## Files Modified:
1. `/src/types/shared.ts` - Added original data fields
2. `/src/components/primitives/EventModal.tsx` - Store original user input
3. `/src/components/primitives/TimeGrid.tsx` - All-day detection logic
4. `/server-src/controllers/CalendarController.ts` - Preserve original data
5. `/server-src/services/ValidationService.ts` - Debug logging
6. `/server-src/utils/iCalendarGenerator.ts` - All-day event handling

## Next Steps to Fix:
1. ✅ Document the issue (this file)
2. 🔄 Fix iCalendar generation to use proper DATE format for all-day events
3. 🔄 Ensure no timezone conversion for all-day events
4. 🔄 Test that CalDAV properly recognizes DATE format as all-day
5. 🔄 Add comprehensive logging to track iCalendar generation
6. 🔄 Add database preservation of original values

## Test Cases Needed:
- [ ] Create all-day event via modal
- [ ] Verify original values are preserved
- [ ] Check iCalendar output uses DATE format
- [ ] Confirm no timezone conversion occurs
- [ ] Verify CalDAV sync maintains all-day status
- [ ] Test editing all-day events
- [ ] Test multi-day all-day events

## Known Issues:
- Original data fields not being saved to database (all showing null)
- iCalendar generator not using DATE format for all-day events
- Timezone conversion happening when it shouldn't for all-day events
- End time calculation wrong for all-day events (1 hour instead of next day)