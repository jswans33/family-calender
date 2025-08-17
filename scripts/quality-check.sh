#!/bin/bash
echo "🔍 QUALITY VALIDATION CHECK"
echo "================================"

# 1. TypeScript validation
echo "📝 TypeScript validation..."
npm run type-check:server

# 2. Database integrity
echo ""
echo "💾 Database integrity check..."
if [ -f "data/calendar.db" ]; then
  EVENTS=$(sqlite3 data/calendar.db "SELECT COUNT(*) FROM events;" 2>/dev/null || echo "0")
  echo "Events in database: $EVENTS"
  
  # Check if calendar columns exist
  SCHEMA=$(sqlite3 data/calendar.db "PRAGMA table_info(events);" 2>/dev/null)
  if echo "$SCHEMA" | grep -q "calendar_path"; then
    echo "✅ Calendar columns exist"
    CALENDAR_EVENTS=$(sqlite3 data/calendar.db "SELECT COUNT(*) FROM events WHERE calendar_path IS NOT NULL;" 2>/dev/null || echo "0")
    echo "Events with calendar metadata: $CALENDAR_EVENTS"
  else
    echo "⚠️  Calendar columns not yet added"
  fi
else
  echo "⚠️  Database not found"
fi

# 3. API health check
echo ""
echo "🌐 API health check..."
if curl -s "http://localhost:3001/health" >/dev/null 2>&1; then
  echo "✅ API server responding"
  
  # Check total events via API
  TOTAL_API=$(curl -s "http://localhost:3001/events" | jq -r '. | length // 0' 2>/dev/null || echo "0")
  echo "Events accessible via API: $TOTAL_API"
  
  # Check calendar endpoint exists
  if curl -s "http://localhost:3001/calendars" >/dev/null 2>&1; then
    echo "✅ Calendars endpoint available"
    curl -s "http://localhost:3001/calendars" | jq '.'
  else
    echo "⚠️  Calendars endpoint not yet implemented"
  fi
  
  # Check calendar-specific access
  echo ""
  echo "📅 Calendar accessibility..."
  for cal in home work shared meals; do
    if curl -s "http://localhost:3001/events?calendar=$cal" >/dev/null 2>&1; then
      count=$(curl -s "http://localhost:3001/events?calendar=$cal" | jq -r '. | length // 0' 2>/dev/null || echo "0")
      echo "  $cal: $count events"
    else
      echo "  $cal: ⚠️  Not yet implemented"
    fi
  done
else
  echo "❌ API server not responding"
fi

# 4. CalDAV validation
echo ""
echo "🗓️  CalDAV validation..."
if [ -f "scripts/get_all_caldav_events.sh" ]; then
  echo "Running CalDAV event count check..."
  ./scripts/get_all_caldav_events.sh | grep "Events found:" | while read line; do
    echo "  CalDAV: $line"
  done
else
  echo "⚠️  CalDAV check script not found"
fi

echo ""
echo "✅ Quality check complete - $(date)"