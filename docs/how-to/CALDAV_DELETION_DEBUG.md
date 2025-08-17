# CalDAV Event Deletion Documentation

## How to Find CalDAV Event Filenames

### Problem

The app creates events with random filenames but tries to delete using UIDs, causing deletion failures.

### Solution: Query CalDAV to Find Actual Filenames

1. **Query CalDAV for all events:**

```bash
curl -s -X REPORT \
  -H "Content-Type: application/xml; charset=utf-8" \
  -H "Depth: 1" \
  -H "Authorization: Basic $(echo -n 'jswans33@gmail.com:qrdq-tahw-xski-ogbf' | base64)" \
  -d '<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag />
    <C:calendar-data />
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT"></C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>' \
  https://p36-caldav.icloud.com/1110188709/calendars/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/
```

2. **Look for `<href>` tags containing `.ics` filenames:**

```xml
<href>/1110188709/calendars/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/event-1755360762620-7hqxzedfzc.ics</href>
```

3. **Match filename to UID in the calendar data:**

- **Filename**: `event-1755360762620-7hqxzedfzc.ics`
- **UID**: `local-1755360762425-yuk3k`
- **Title**: "Multi-Day Test"

4. **Delete using the actual filename (not UID):**

```bash
curl -X DELETE \
  -H "Authorization: Basic $(echo -n 'jswans33@gmail.com:qrdq-tahw-xski-ogbf' | base64)" \
  https://p36-caldav.icloud.com/1110188709/calendars/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/event-1755360762620-7hqxzedfzc.ics
```

## Current Filename Inconsistency Bug

### Creation Process

- File: `CalDAVRepository.ts:481`
- Uses: `const filename = \`${encodeURIComponent(event.id)}.ics\`;` (FIXED)
- Previously used: `event-${Date.now()}-${Math.random()}.ics` (random filename)

### Deletion Process

- File: `CalDAVRepository.ts:396`
- Uses: `const encodedEventId = encodeURIComponent(eventId);`
- Tries to delete: `${eventId}.ics`

### Result

- **Creation filename**: `event-1755360762620-7hqxzedfzc.ics`
- **Deletion attempts**: `local-1755360762425-yuk3k.ics`
- **Status**: 404 Not Found (event remains on iPhone)

### Fix Applied

Changed creation to use UID as filename for consistency.

## Working Deletion Method

Use direct curl with actual CalDAV filename discovered via REPORT query.
