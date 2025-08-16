# Calendar API Documentation

## Base URL
```
http://localhost:3001
```

## Authentication
Currently uses Apple CalDAV credentials configured server-side. Future versions will support API key authentication.

## Endpoints

### GET /events
Retrieve all calendar events.

**Query Parameters:**
- `start` (optional): Start date in YYYY-MM-DD format
- `end` (optional): End date in YYYY-MM-DD format

**Example:**
```bash
curl "http://localhost:3001/events"
curl "http://localhost:3001/events?start=2025-01-01&end=2025-01-31"
```

**Response:**
```json
[
  {
    "id": "ABC123-DEF456",
    "title": "Team Meeting",
    "date": "2025-08-15T09:00:00.000Z",
    "time": "09:00 AM",
    "description": "Weekly team sync",
    "location": "Conference Room A",
    "organizer": "john@company.com",
    "attendees": ["alice@company.com", "bob@company.com"],
    "categories": ["work", "meeting"],
    "priority": 5,
    "status": "CONFIRMED",
    "visibility": "PUBLIC",
    "dtend": "2025-08-15T10:00:00.000Z",
    "duration": "PT1H0M",
    "rrule": "FREQ=WEEKLY;BYDAY=TH",
    "created": "2025-08-01T12:00:00.000Z",
    "lastModified": "2025-08-10T15:30:00.000Z",
    "sequence": 2,
    "url": "https://zoom.us/j/123456789",
    "geo": { "lat": 37.7749, "lon": -122.4194 },
    "transparency": "OPAQUE",
    "attachments": ["https://docs.company.com/agenda.pdf"],
    "timezone": "America/Los_Angeles"
  }
]
```

### GET /events/today
Retrieve events for today.

**Example:**
```bash
curl "http://localhost:3001/events/today"
```

### GET /events/week
Retrieve events for this week (Sunday to Saturday).

**Example:**
```bash
curl "http://localhost:3001/events/week"
```

### GET /events/month
Retrieve events for this month.

**Example:**
```bash
curl "http://localhost:3001/events/month"
```

## Response Schema

### CalendarEvent Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique event identifier |
| `title` | string | Yes | Event title/summary |
| `date` | string | Yes | Start date in ISO 8601 format |
| `time` | string | Yes | Formatted start time |
| `description` | string | No | Event description/notes |
| `location` | string | No | Event location |
| `organizer` | string | No | Event organizer email |
| `attendees` | string[] | No | List of attendee emails |
| `categories` | string[] | No | Event categories/tags |
| `priority` | number | No | Priority level (1-9) |
| `status` | string | No | Event status: "CONFIRMED", "TENTATIVE", "CANCELLED" |
| `visibility` | string | No | Visibility: "PUBLIC", "PRIVATE", "CONFIDENTIAL" |
| `dtend` | string | No | End date in ISO 8601 format |
| `duration` | string | No | Duration in ISO 8601 format |
| `rrule` | string | No | Recurrence rule |
| `created` | string | No | Creation timestamp |
| `lastModified` | string | No | Last modification timestamp |
| `sequence` | number | No | Version sequence number |
| `url` | string | No | Related URL |
| `geo` | object | No | GPS coordinates `{lat: number, lon: number}` |
| `transparency` | string | No | Transparency: "OPAQUE", "TRANSPARENT" |
| `attachments` | string[] | No | List of attachment URLs |
| `timezone` | string | No | Event timezone |

## Error Responses

### 500 Internal Server Error
```json
{
  "error": "Failed to fetch calendar events",
  "message": "CalDAV connection failed"
}
```

## Rate Limiting
Currently no rate limiting implemented. Future versions will include:
- 100 requests per minute per IP
- 1000 requests per hour per API key

## Pagination
Not currently implemented. All matching events are returned in a single response.

## Filtering
Events can be filtered by date range using query parameters. Additional filtering options planned:
- Category filtering
- Status filtering
- Attendee filtering
- Location-based filtering

## WebSocket Support
Planned for future versions to provide real-time event updates.

## SDK Examples

### JavaScript/Node.js
```javascript
const response = await fetch('http://localhost:3001/events/today');
const events = await response.json();

console.log(`Found ${events.length} events today`);
events.forEach(event => {
  console.log(`${event.time}: ${event.title}`);
  if (event.location) {
    console.log(`  Location: ${event.location}`);
  }
});
```

### Python
```python
import requests
from datetime import datetime, timedelta

# Get events for next 7 days
start = datetime.now().strftime('%Y-%m-%d')
end = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')

response = requests.get(f'http://localhost:3001/events?start={start}&end={end}')
events = response.json()

for event in events:
    print(f"{event['time']}: {event['title']}")
    if event.get('location'):
        print(f"  📍 {event['location']}")
    if event.get('attendees'):
        print(f"  👥 {len(event['attendees'])} attendees")
```

### curl
```bash
# Get today's events with formatted output
curl -s "http://localhost:3001/events/today" | \
  jq '.[] | "\(.time): \(.title) \(if .location then "@ " + .location else "" end)"'

# Get events with attendees
curl -s "http://localhost:3001/events" | \
  jq '[.[] | select(.attendees != null)] | length'

# Get this week's meetings
curl -s "http://localhost:3001/events/week" | \
  jq '[.[] | select(.categories != null and (.categories | contains(["meeting"])))]'
```

## Changelog

### v1.0.0 (Current)
- Initial release
- Basic CalDAV integration
- Core CRUD endpoints
- Rich event data extraction
- Date range filtering

### Planned v1.1.0
- Event creation/modification
- WebSocket real-time updates
- Advanced filtering options
- API key authentication
- Rate limiting

### Planned v2.0.0
- Multiple calendar provider support
- GraphQL API
- Event conflict detection
- Smart categorization