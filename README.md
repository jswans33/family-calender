# Apple Calendar Integration - Simple Calendar App

A minimal React calendar app that connects to Apple Calendar using CalDAV protocol. Features real-time event syncing and a clean month view interface.

## Features

- 📅 Clean month view calendar interface
- 🍎 Apple Calendar integration via CalDAV
- 🔄 Real-time event syncing
- 🔒 App-specific password authentication
- 📱 Responsive design
- ⚡ TypeScript support (optional)

## Quick Start

### Prerequisites

- Node.js 16+ 
- Apple ID with 2-factor authentication enabled
- App-specific password for Apple Calendar access

### Installation

```bash
# Clone or navigate to project directory
cd swanson-light

# Install dependencies
npm install

# Start the backend server
npm run start:server

# In a new terminal, start the React app
npm start
```

## Apple Calendar Setup

### 1. Enable Two-Factor Authentication
1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in with your Apple ID
3. Navigate to **Security** section
4. Enable **Two-Factor Authentication** if not already enabled

### 2. Generate App-Specific Password
1. In the Security section, click **App-Specific Passwords**
2. Click **Generate an app-specific password**
3. Enter a label like "Calendar App" or "CalDAV Access"
4. **Copy the generated password** (format: `xxxx-xxxx-xxxx-xxxx`)

### 3. Configure Credentials
Edit `config.json` with your Apple ID credentials:

```json
{
  "calendar": {
    "type": "apple",
    "url": "https://p36-caldav.icloud.com:443/1110188709/calendars/home/",
    "username": "your-apple-id@icloud.com",
    "password": "your-app-specific-password",
    "calendar_name": "home"
  }
}
```

> **Note:** Replace the URL with your specific CalDAV URL (see Discovery section below)

## CalDAV URL Discovery

Your CalDAV URL is unique to your Apple ID. Here's how to find it:

### Method 1: Automated Discovery
```bash
curl -X PROPFIND \
  -H "Content-Type: application/xml; charset=utf-8" \
  -H "Depth: 0" \
  -H "Authorization: Basic $(echo -n 'your-email:app-password' | base64)" \
  -d '<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <C:calendar-home-set />
  </D:prop>
</D:propfind>' \
  https://caldav.icloud.com/.well-known/caldav
```

### Method 2: Manual Configuration
1. Replace `your-email` and `app-password` in the URL discovery curl command
2. Look for the `<href>` tag in the response containing your CalDAV URL
3. Update `config.json` with the discovered URL

### Method 3: Common URL Patterns
iCloud CalDAV URLs typically follow this pattern:
```
https://p[XX]-caldav.icloud.com:443/[USER_ID]/calendars/[CALENDAR_NAME]/
```

Where:
- `p[XX]` is a server identifier (like p36, p12, p40, etc.)
- `[USER_ID]` is your unique iCloud user identifier
- `[CALENDAR_NAME]` is usually "home" for the main calendar

## Project Structure

```
swanson-light/
├── config.json              # Apple Calendar credentials
├── package.json             # Dependencies and scripts
├── server.js               # Node.js CalDAV server
├── public/
│   └── index.html          # React app entry point
└── src/
    ├── App.js              # Main React component
    ├── App.css             # Styling
    ├── index.js            # React DOM entry
    ├── components/
    │   └── Calendar.js     # Calendar grid component
    └── services/
        └── CalendarService.js  # API communication layer
```

## API Endpoints

### GET /events
Returns all calendar events from Apple Calendar.

**Response:**
```json
[
  {
    "id": "unique-event-id",
    "title": "Event Title", 
    "date": "2025-07-19T14:30:00.000Z",
    "time": "02:30 PM"
  }
]
```

## Converting to TypeScript

### 1. Install TypeScript Dependencies

```bash
npm install --save-dev typescript @types/node @types/express @types/cors ts-node nodemon
npm install --save-dev @types/react @types/react-dom
```

### 2. Create TypeScript Configuration

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "server.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### 3. Convert Server to TypeScript

Create `server.ts`:
```typescript
import express from 'express';
import cors from 'cors';
import https from 'https';
import { parseICS } from 'node-ical';
import config from './config.json';

// Type definitions
interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
}

interface CalendarConfig {
  type: string;
  url: string;
  username: string;
  password: string;
  calendar_name: string;
}

interface Config {
  calendar: CalendarConfig;
}

const app = express();
const port = 3001;

app.use(cors());

/**
 * Makes a CalDAV REPORT request to Apple's iCloud servers
 * @returns Promise<string> Raw XML response from CalDAV server
 */
async function makeCalDAVRequest(): Promise<string> {
  return new Promise((resolve, reject) => {
    // Base64 encode credentials for Basic Auth
    const auth = Buffer.from(`${config.calendar.username}:${config.calendar.password}`).toString('base64');
    
    // CalDAV query to fetch all VEVENT components
    const postData = `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag />
    <C:calendar-data />
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT" />
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

    const options: https.RequestOptions = {
      hostname: 'p36-caldav.icloud.com',
      port: 443,
      path: '/1110188709/calendars/home/',
      method: 'REPORT',
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(postData),
        'Depth': '1',
        'Authorization': `Basic ${auth}`
      }
    };

    const req = https.request(options, (response) => {
      let data = '';
      response.on('data', (chunk: Buffer) => {
        data += chunk.toString();
      });
      response.on('end', () => {
        resolve(data);
      });
    });

    req.on('error', (error: Error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Parses CalDAV XML response and extracts calendar events
 * @param xmlData Raw XML response from CalDAV server
 * @returns Array of parsed calendar events
 */
function parseCalDAVResponse(xmlData: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  
  try {
    console.log('Parsing CalDAV response...');
    
    // Extract iCal data from CDATA sections in XML
    const icalMatches = xmlData.match(/<calendar-data[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/calendar-data>/gi);
    
    if (icalMatches) {
      console.log(`Found ${icalMatches.length} calendar entries`);
      
      icalMatches.forEach((match, index) => {
        // Strip XML wrapper to get pure iCal content
        const icalContent = match.replace(/<calendar-data[^>]*><!\[CDATA\[/, '').replace(/\]\]><\/calendar-data>/, '');
        
        try {
          const parsedCal = parseICS(icalContent);
          
          // Extract VEVENT components
          for (const k in parsedCal) {
            const event = parsedCal[k];
            if (event.type === 'VEVENT') {
              console.log(`Found event: ${event.summary}`);
              events.push({
                id: event.uid || k,
                title: event.summary || 'No Title',
                date: event.start ? new Date(event.start).toISOString() : new Date().toISOString(),
                time: event.start ? new Date(event.start).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                }) : 'All Day'
              });
            }
          }
        } catch (parseError) {
          console.error(`Error parsing iCal entry ${index}:`, parseError);
        }
      });
    } else {
      console.log('No calendar data found in response');
    }
  } catch (error) {
    console.error('Error parsing CalDAV response:', error);
  }
  
  return events;
}

/**
 * GET /events - Fetch all calendar events from Apple Calendar
 */
app.get('/events', async (req: express.Request, res: express.Response) => {
  try {
    console.log('Fetching events from Apple Calendar...');
    const response = await makeCalDAVRequest();
    
    if (response) {
      const events = parseCalDAVResponse(response);
      console.log(`Found ${events.length} events`);
      
      if (events.length > 0) {
        res.json(events);
        return;
      }
    }
    
    // Fallback to mock events if no real events found
    const mockEvents: CalendarEvent[] = [
      {
        id: '1',
        title: 'No Calendar Access - Demo Event',
        date: new Date().toISOString(),
        time: '10:00 AM'
      }
    ];
    
    res.json(mockEvents);
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    
    const mockEvents: CalendarEvent[] = [
      {
        id: '1',
        title: 'Error - Demo Event',
        date: new Date().toISOString(),
        time: '10:00 AM'
      }
    ];
    
    res.json(mockEvents);
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
```

### 4. Update Package Scripts

Add TypeScript scripts to `package.json`:
```json
{
  "scripts": {
    "start": "react-scripts start",
    "start:server": "node server.js",
    "start:server:ts": "ts-node server.ts",
    "start:server:dev": "nodemon --exec ts-node server.ts",
    "build": "react-scripts build",
    "build:server": "tsc && node dist/server.js"
  }
}
```

### 5. Run TypeScript Version

```bash
# Development with auto-reload
npm run start:server:dev

# Production build
npm run build:server
```

## Troubleshooting

### Common Issues

**"401 Unauthorized" Error:**
- Verify your Apple ID credentials
- Ensure you're using an app-specific password, not your regular password
- Check that 2-factor authentication is enabled

**"No events showing":**
- Events only show for the current month
- Navigate to months with existing events
- Add a test event in Apple Calendar for the current month

**"CalDAV URL not working":**
- Run the URL discovery process again
- Your CalDAV server URL may have changed
- Try different calendar names ("home", "Calendar", etc.)

**"Server connection failed":**
- Ensure the backend server is running on port 3001
- Check firewall settings
- Verify network connectivity

### Debugging Tips

1. **Check server logs** for CalDAV request details
2. **Test CalDAV directly** with curl commands
3. **Verify credentials** in config.json
4. **Monitor network requests** in browser dev tools

## Security Notes

- Never commit your `config.json` with real credentials to version control
- App-specific passwords are safer than your main Apple ID password
- Consider using environment variables for production deployments
- The CalDAV connection uses HTTPS encryption

## License

MIT License - Feel free to use this project as a starting point for your own calendar applications.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues related to:
- **Apple Calendar connectivity**: Check Apple's CalDAV documentation
- **iCloud authentication**: Visit Apple Support
- **Code issues**: Open a GitHub issue with debug logs# family-calender
