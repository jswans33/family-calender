#!/bin/bash

echo "=== GETTING FULL CALDAV RESPONSE ==="
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
  https://p36-caldav.icloud.com/1110188709/calendars/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/ > /tmp/caldav_response.xml

echo "=== EVENTS FOUND ==="
grep -E "(href.*\.ics|UID:|SUMMARY:)" /tmp/caldav_response.xml

echo "=== FILES TO DELETE ==="
grep "href.*\.ics" /tmp/caldav_response.xml | sed 's/.*\/\([^\/]*\.ics\).*/\1/' | while read filename; do
    if [[ "$filename" != "event-1755324647042-95uldf8xaeu.ics" ]]; then
        echo "DELETE: $filename"
        curl -X DELETE \
          -H "Authorization: Basic $(echo -n 'jswans33@gmail.com:qrdq-tahw-xski-ogbf' | base64)" \
          https://p36-caldav.icloud.com/1110188709/calendars/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/$filename
        echo "Deleted: $filename"
    else
        echo "KEEP: $filename (Buy chips)"
    fi
done