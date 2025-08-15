#!/bin/bash

# Calendar API Test Script
# Tests all calendar endpoints with various scenarios

SERVER_URL="http://localhost:3001"
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🗓️  Calendar API Test Suite${NC}"
echo "================================="

# Function to test an endpoint
test_endpoint() {
    local endpoint=$1
    local description=$2
    local expected_status=${3:-200}
    
    echo -e "\n${BLUE}Testing:${NC} $description"
    echo "GET $SERVER_URL$endpoint"
    
    # Make the request and capture both status and response
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$SERVER_URL$endpoint")
    status=$(echo "$response" | grep "HTTPSTATUS" | cut -d: -f2)
    body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    if [ "$status" -eq "$expected_status" ]; then
        echo -e "${GREEN}✅ Status: $status${NC}"
        
        # Pretty print JSON if it's a successful response
        if [ "$status" -eq 200 ] && [ -n "$body" ]; then
            echo "$body" | jq '.[0:2] | map({
                id: .id,
                title: .title,
                date: .date,
                time: .time,
                location: .location // "N/A",
                description: (.description // "No description")[0:50] + "...",
                attendees: .attendees // [],
                status: .status // "N/A"
            })' 2>/dev/null || echo "$body"
        fi
    else
        echo -e "${RED}❌ Status: $status (expected $expected_status)${NC}"
        echo "$body"
    fi
}

# Check if server is running
echo -e "\n${BLUE}Checking server status...${NC}"
if ! curl -s "$SERVER_URL/events" > /dev/null; then
    echo -e "${RED}❌ Server not running at $SERVER_URL${NC}"
    echo "Please start the server with: npm run start:server:dev"
    exit 1
fi

echo -e "${GREEN}✅ Server is running${NC}"

# Test 1: Get all events
test_endpoint "/events" "Get all events"

# Test 2: Get today's events
test_endpoint "/events/today" "Get today's events"

# Test 3: Get this week's events  
test_endpoint "/events/week" "Get this week's events"

# Test 4: Get this month's events
test_endpoint "/events/month" "Get this month's events"

# Test 5: Get events with date range (next 7 days)
START_DATE=$(date +%Y-%m-%d)
END_DATE=$(date -d "+7 days" +%Y-%m-%d)
test_endpoint "/events?start=$START_DATE&end=$END_DATE" "Get events for next 7 days (${START_DATE} to ${END_DATE})"

# Test 6: Get events with specific date range
test_endpoint "/events?start=2025-01-01&end=2025-01-31" "Get events for January 2025"

# Test 7: Get events with invalid date range
test_endpoint "/events?start=invalid-date" "Get events with invalid start date"

# Test 8: Test server error handling
test_endpoint "/nonexistent" "Test 404 endpoint" 404

echo -e "\n${BLUE}=================================${NC}"
echo -e "${GREEN}✅ API Test Suite Complete!${NC}"
echo -e "\n${BLUE}Response Data Structure:${NC}"
echo "Each event now includes:"
echo "• id, title, date, time (basic fields)"
echo "• description, location, organizer (details)"
echo "• attendees, categories, priority (organization)"
echo "• status, visibility, timezone (metadata)"
echo "• dtend, duration, rrule (timing)"
echo "• geo, attachments, url (enhanced data)"