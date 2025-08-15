#!/bin/bash

# Simple curl examples for manual testing
# Run these commands individually to test specific endpoints

echo "🔧 Calendar API Curl Examples"
echo "============================="

echo "
# 1. Get all events
curl -X GET http://localhost:3001/events | jq

# 2. Get today's events only  
curl -X GET http://localhost:3001/events/today | jq

# 3. Get this week's events
curl -X GET http://localhost:3001/events/week | jq

# 4. Get this month's events
curl -X GET http://localhost:3001/events/month | jq

# 5. Get events in a specific date range
curl -X GET 'http://localhost:3001/events?start=2025-08-15&end=2025-08-22' | jq

# 6. Get events for a specific month
curl -X GET 'http://localhost:3001/events?start=2025-01-01&end=2025-01-31' | jq

# 7. Test error handling with invalid date
curl -X GET 'http://localhost:3001/events?start=invalid-date' | jq

# 8. Get raw response without JSON formatting
curl -X GET http://localhost:3001/events/today

# 9. Get response headers
curl -I http://localhost:3001/events

# 10. Test with verbose output
curl -v http://localhost:3001/events/today
"

echo "📋 To run these commands:"
echo "1. Start server: npm run start:server:dev"
echo "2. Copy and paste any command above"
echo "3. Add '| jq' for pretty JSON formatting"