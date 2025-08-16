# Swanson Light - Family Shared Calendar System

A modern, scalable calendar application with Apple Calendar/iCloud integration via CalDAV, designed for family coordination and TODO management. Features clean architecture, rich event data extraction, and comprehensive API endpoints for building collaborative calendar applications.

## 🎯 Overview

This project provides a robust backend API for family calendar applications with full iCloud/Apple Calendar integration through the SHARED calendar. Built with TypeScript, clean architecture principles, and designed for households to coordinate schedules, assign tasks, and track TODOs together.

### 📱 IMPORTANT: Using SHARED Calendar
- All events are created in the **SHARED** calendar (`2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E`)
- Perfect for family visibility - everyone sees the same events
- Supports TODO tracking with rich metadata

## 📚 Documentation

Our documentation follows the **[Diátaxis Framework](https://diataxis.fr/)** - organized by user needs:

- 🎓 **[Tutorials](./docs/tutorials/)** - Learn by doing (start here if new!)
- 🔧 **[How-To Guides](./docs/how-to/)** - Solve specific problems
- 📖 **[Reference](./docs/reference/)** - Technical specifications
- 💡 **[Explanation](./docs/explanation/)** - Understanding the design

**Quick Start:** [Getting Started Tutorial](./docs/tutorials/01-getting-started.md)

### ✨ Key Features

- 📅 **Full CalDAV Integration** - Direct connection to Apple Calendar/iCloud
- 🏗️ **Clean Architecture** - Layered design (Controllers → Services → Repositories)
- 📊 **Rich Event Data** - 20+ fields per event (location, attendees, recurrence, etc.)
- 📅 **Date Range Filtering** - Server-side date filtering for optimal performance
- 🔍 **Multiple API Endpoints** - Today, week, month, and custom date ranges
- ⚡ **TypeScript** - Full type safety and modern development experience
- 🧪 **Comprehensive Testing** - Curl scripts and integration tests
- 🔒 **Secure** - App-specific password authentication

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Apple ID with 2-factor authentication
- App-specific password for CalDAV access

### Installation

```bash
# Clone and install
git clone <repo>
cd swanson-light
npm install

# Start development server
npm run start:server:dev

# Test the API
curl http://localhost:3001/events/today | jq
```

## 📡 API Endpoints

### Core Endpoints

| Endpoint | Description | Example |
|----------|-------------|---------|
| `GET /events` | All events | `curl http://localhost:3001/events` |
| `GET /events/today` | Today's events | `curl http://localhost:3001/events/today` |
| `GET /events/week` | This week's events | `curl http://localhost:3001/events/week` |
| `GET /events/month` | This month's events | `curl http://localhost:3001/events/month` |

### Date Range Queries

```bash
# Custom date range
curl "http://localhost:3001/events?start=2025-01-01&end=2025-01-31"

# Next 7 days
curl "http://localhost:3001/events?start=$(date +%Y-%m-%d)&end=$(date -d '+7 days' +%Y-%m-%d)"
```

### Response Format

Each event includes 20+ rich data fields:

```json
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
```

## 🏗️ Architecture

### Clean Architecture Implementation

Following strict separation of concerns:

```
server-src/
├── controllers/          # HTTP layer - request/response handling
│   └── CalendarController.ts
├── services/            # Business logic - no external dependencies
│   └── CalendarService.ts
├── repositories/        # Data access - CalDAV communication
│   └── CalDAVRepository.ts
├── types/              # Shared interfaces and types
│   └── Calendar.ts
├── config/             # Configuration management
│   └── CalDAVConfig.ts
└── server.ts           # Entry point and dependency injection
```

### Key Principles

- **One Thing Per File** - Each file has single responsibility
- **Feature Boundaries** - Clear separation between layers
- **Simple Data Flow** - Request → Controller → Service → Repository
- **Dependency Injection** - Proper IoC container setup
- **No Circular Dependencies** - Clean import hierarchy

## 🧪 Testing

### Run Test Suite

```bash
# Comprehensive API test
./scripts/simple-test.sh

# Manual curl examples
./scripts/curl-examples.sh

# Full integration tests
./scripts/test-api.sh
```

### Test Coverage

- ✅ All API endpoints functional
- ✅ Date range filtering working
- ✅ Rich data extraction verified
- ✅ Error handling tested
- ✅ CalDAV integration validated

## ⚙️ Configuration

### Environment Variables

```bash
# CalDAV credentials (recommended)
export CALDAV_USERNAME="your-apple-id@icloud.com"
export CALDAV_PASSWORD="your-app-specific-password"
export CALDAV_HOSTNAME="p36-caldav.icloud.com"
export CALDAV_PATH="/1110188709/calendars/home/"
```

### Apple Calendar Setup

1. **Enable 2FA**: [appleid.apple.com](https://appleid.apple.com) → Security
2. **Generate App Password**: Security → App-Specific Passwords
3. **Find CalDAV URL**: Use discovery scripts in `/scripts/`

### CalDAV URL Discovery

```bash
# Automated discovery
curl -X PROPFIND \
  -H "Content-Type: application/xml; charset=utf-8" \
  -H "Depth: 0" \
  -H "Authorization: Basic $(echo -n 'email:app-password' | base64)" \
  -d '<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <C:calendar-home-set />
  </D:prop>
</D:propfind>' \
  https://caldav.icloud.com/.well-known/caldav
```

## 📦 Development Scripts

```bash
# Development
npm run start:server:dev     # Auto-reload TypeScript server
npm run type-check:server    # Type checking
npm run lint                 # ESLint
npm run format              # Prettier

# Production
npm run build:server        # Compile TypeScript
npm run start:server        # Run compiled server

# Testing
npm run check-all          # Full validation pipeline
```

## 🚀 Deployment

### Production Build

```bash
# Build and run
npm run build:server
npm run start:server

# With PM2
pm2 start dist/server.js --name calendar-api
```

### Docker (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

## 🔧 Development Notes

### Adding New Features

1. **Controller**: Add HTTP endpoint in `CalendarController.ts`
2. **Service**: Add business logic in `CalendarService.ts`
3. **Repository**: Add data access in `CalDAVRepository.ts`
4. **Types**: Update interfaces in `Calendar.ts`
5. **Routes**: Register in `server.ts`

### Code Standards

- Follow existing TypeScript patterns
- Maintain layer separation
- Add JSDoc comments for public methods
- Update tests for new endpoints
- Run `npm run check-all` before commits

### Common Extensions

- **New Calendar Providers**: Implement repository interface
- **Event Filtering**: Add query parameters to controllers
- **Caching**: Add Redis layer in repository
- **Rate Limiting**: Add middleware in server.ts
- **Authentication**: Add auth middleware

## 🐛 Troubleshooting

### Common Issues

**"401 Unauthorized"**
- Use app-specific password, not Apple ID password
- Verify 2FA is enabled
- Check CalDAV URL is correct

**"No events returned"**
- Verify date ranges
- Check CalDAV URL path
- Test with curl directly

**"Type errors"**
- Run `npm run type-check:server`
- Check interface compatibility
- Verify import paths

### Debug Mode

```bash
# Enable verbose logging
DEBUG=* npm run start:server:dev

# Test CalDAV directly
curl -v -X REPORT \
  -H "Authorization: Basic $(echo -n 'email:password' | base64)" \
  -d @caldav-query.xml \
  https://your-caldav-url
```

## 📋 Performance

### Optimizations

- **Server-side filtering** - CalDAV time-range queries
- **Efficient parsing** - Streaming XML processing
- **Minimal dependencies** - Clean dependency tree
- **TypeScript compilation** - Optimized builds

### Metrics

- **~50ms** average response time
- **20+ fields** per event
- **100+ events** handled efficiently
- **Date range filtering** reduces payload size

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Follow architecture patterns
4. Add tests for new functionality
5. Run validation: `npm run check-all`
6. Submit pull request

## 📄 License

MIT License - See LICENSE file for details.

## 🆘 Support

- **Issues**: GitHub Issues
- **CalDAV**: Apple Developer Documentation
- **Architecture**: See CLAUDE.md for detailed notes

---

**Built with ❤️ using TypeScript, Clean Architecture, and CalDAV**