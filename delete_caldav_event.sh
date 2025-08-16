#!/bin/bash

# Script to find and delete CalDAV events properly

# Function to get all CalDAV events
get_caldav_events() {
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
}

# Function to delete event by filename
delete_caldav_event() {
    local filename=$1
    echo "Deleting: $filename"
    curl -X DELETE \
      -H "Authorization: Basic $(echo -n 'jswans33@gmail.com:qrdq-tahw-xski-ogbf' | base64)" \
      https://p36-caldav.icloud.com/1110188709/calendars/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/$filename
    echo "Delete attempt completed for: $filename"
}

# Show current events
echo "=== CURRENT CALDAV EVENTS ==="
get_caldav_events

# Extract filenames and delete Multi-Day Test
echo "=== FINDING MULTI-DAY TEST EVENT ==="
MULTI_DAY_FILE=$(get_caldav_events | grep -A10 "Multi-Day Test" | grep "href" | sed 's/.*\/\([^\/]*\.ics\).*/\1/')

if [ -n "$MULTI_DAY_FILE" ]; then
    echo "Found Multi-Day Test event: $MULTI_DAY_FILE"
    delete_caldav_event "$MULTI_DAY_FILE"
else
    echo "Multi-Day Test event not found"
fi

echo "=== EVENTS AFTER DELETION ==="
get_caldav_events