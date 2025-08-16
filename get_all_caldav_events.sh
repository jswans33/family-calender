#!/bin/bash

CALDAV_BASE="https://p36-caldav.icloud.com/1110188709/calendars"
AUTH_HEADER="Authorization: Basic $(echo -n 'jswans33@gmail.com:qrdq-tahw-xski-ogbf' | base64)"

# Function to get all calendars
get_calendars() {
    curl -s -X PROPFIND \
      -H "Content-Type: application/xml; charset=utf-8" \
      -H "Depth: 1" \
      -H "$AUTH_HEADER" \
      -d '<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:displayname />
    <C:supported-calendar-component-set />
  </D:prop>
</D:propfind>' \
      $CALDAV_BASE/
}

# Function to get events from a specific calendar
get_events_from_calendar() {
    local calendar_path=$1
    local calendar_name=$2
    
    echo "=== CALENDAR: $calendar_name ($calendar_path) ==="
    
    curl -s -X REPORT \
      -H "Content-Type: application/xml; charset=utf-8" \
      -H "Depth: 1" \
      -H "$AUTH_HEADER" \
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
      "$CALDAV_BASE$calendar_path" > "/tmp/calendar_${calendar_name}.xml"
    
    # Extract and display events
    local event_count=$(grep -c "SUMMARY:" "/tmp/calendar_${calendar_name}.xml" 2>/dev/null || echo "0")
    echo "Events found: $event_count"
    
    if [ "$event_count" -gt 0 ]; then
        echo "--- Event Details ---"
        grep -E "(href.*\.ics|UID:|SUMMARY:|DTSTART|DTEND)" "/tmp/calendar_${calendar_name}.xml" | while read line; do
            if [[ "$line" == *"href"*".ics"* ]]; then
                filename=$(echo "$line" | sed 's/.*\/\([^\/]*\.ics\).*/\1/')
                echo "FILE: $filename"
            elif [[ "$line" == *"UID:"* ]]; then
                uid=$(echo "$line" | sed 's/.*UID:\(.*\)/\1/')
                echo "UID: $uid"
            elif [[ "$line" == *"SUMMARY:"* ]]; then
                summary=$(echo "$line" | sed 's/.*SUMMARY:\(.*\)/\1/')
                echo "TITLE: $summary"
            elif [[ "$line" == *"DTSTART"* ]]; then
                dtstart=$(echo "$line" | sed 's/.*DTSTART[^:]*:\(.*\)/\1/')
                echo "START: $dtstart"
            elif [[ "$line" == *"DTEND"* ]]; then
                dtend=$(echo "$line" | sed 's/.*DTEND[^:]*:\(.*\)/\1/')
                echo "END: $dtend"
                echo "---"
            fi
        done
    fi
    echo ""
}

# Function to delete event by filename and calendar
delete_event() {
    local calendar_path=$1
    local filename=$2
    local calendar_name=$3
    
    echo "DELETING: $filename from $calendar_name"
    curl -v -X DELETE \
      -H "$AUTH_HEADER" \
      "$CALDAV_BASE$calendar_path$filename" 2>&1
    echo "Delete completed for: $filename"
}

echo "=== GETTING ALL CALENDARS ==="
get_calendars > /tmp/all_calendars.xml

echo "=== FOUND CALENDARS ==="
grep -E "(href>/.*calendars/.*/<|displayname)" /tmp/all_calendars.xml | while read line; do
    if [[ "$line" == *"href>"* ]]; then
        calendar_path=$(echo "$line" | sed 's/.*href>\(.*\)<\/href.*/\1/' | sed 's/.*\/calendars//')
        echo "PATH: $calendar_path"
    elif [[ "$line" == *"displayname"* ]]; then
        calendar_name=$(echo "$line" | sed 's/.*displayname[^>]*>\(.*\)<\/displayname.*/\1/')
        echo "NAME: $calendar_name"
        echo "---"
    fi
done

echo ""
echo "=== GETTING EVENTS FROM ALL CALENDARS ==="

# Main calendars to check
calendars=(
    "/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/:Shared"
    "/home/:Home"
    "/work/:Work"
    "/1fa1e4097e27af6d41607163c20c088e70cf8e9db9d71b1a62611ec364123914/:Meals"
)

for calendar_info in "${calendars[@]}"; do
    calendar_path=$(echo "$calendar_info" | cut -d':' -f1)
    calendar_name=$(echo "$calendar_info" | cut -d':' -f2)
    get_events_from_calendar "$calendar_path" "$calendar_name"
done

echo "=== SCRIPT COMPLETE ==="
echo "Temp files saved in /tmp/calendar_*.xml for detailed inspection"