#!/bin/bash

echo "🗓️  Calendar API Demo"
echo "==================="

echo -e "\n✅ 1. All Events (first 3):"
curl -s http://localhost:3001/events | jq '.[0:3] | map({title, date, location: (.location // "No location")})'

echo -e "\n✅ 2. Today's Events:"
curl -s http://localhost:3001/events/today | jq 'length as $count | "Found \($count) events today"'

echo -e "\n✅ 3. This Week's Events:"
curl -s http://localhost:3001/events/week | jq 'length as $count | "Found \($count) events this week"'

echo -e "\n✅ 4. This Month's Events:"
curl -s http://localhost:3001/events/month | jq 'length as $count | "Found \($count) events this month"'

echo -e "\n✅ 5. Date Range Query (Jan 2025):"
curl -s "http://localhost:3001/events?start=2025-01-01&end=2025-01-31" | jq 'length as $count | "Found \($count) events in January 2025"'

echo -e "\n✅ 6. Rich Event Data Sample:"
curl -s http://localhost:3001/events/today | jq '.[0] | {
  title,
  date,
  location,
  description: (.description // "No description")[0:80],
  organizer,
  attendees,
  status,
  duration,
  timezone
}'

echo -e "\n✅ 7. Events with Attendees:"
curl -s http://localhost:3001/events | jq '[.[] | select(.attendees != null)] | length as $count | "Found \($count) events with attendees"'

echo -e "\n✅ 8. Events with GPS Coordinates:"
curl -s http://localhost:3001/events | jq '[.[] | select(.geo != null)] | length as $count | "Found \($count) events with GPS data"'

echo -e "\n🎯 API Endpoints Available:"
echo "• GET /events - All events"
echo "• GET /events/today - Today's events"
echo "• GET /events/week - This week's events"  
echo "• GET /events/month - This month's events"
echo "• GET /events?start=YYYY-MM-DD&end=YYYY-MM-DD - Date range"

echo -e "\n📊 Rich Data Fields Extracted:"
echo "• Basic: id, title, date, time"
echo "• Details: description, location, organizer"
echo "• People: attendees, categories, priority"
echo "• Status: status, visibility, transparency"
echo "• Timing: dtend, duration, rrule, timezone"
echo "• Enhanced: geo coordinates, attachments, url"