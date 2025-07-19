import express from 'express';
import cors from 'cors';
import https from 'https';
import { parseICS } from 'node-ical';
import config from './config.json' with { type: 'json' };

// Type definitions for our calendar data structures
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
 * Sends a REPORT request with calendar-query to fetch all VEVENT components
 * @returns Promise<string> Raw XML response from CalDAV server
 */
async function makeCalDAVRequest(): Promise<string> {
  return new Promise((resolve, reject) => {
    // Base64 encode Apple ID credentials for Basic Authentication
    const auth = Buffer.from('jswans33@gmail.com:qrdq-tahw-xski-ogbf').toString('base64');
    
    // CalDAV REPORT query - requests all VEVENT components (calendar events)
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

    // HTTPS request options for Apple's CalDAV server
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
      // Collect response data chunks
      response.on('data', (chunk: Buffer) => {
        data += chunk.toString();
      });
      // Return complete response when finished
      response.on('end', () => {
        resolve(data);
      });
    });

    // Handle request errors
    req.on('error', (error: Error) => {
      reject(error);
    });

    // Send the CalDAV query
    req.write(postData);
    req.end();
  });
}

/**
 * Parses CalDAV XML response and extracts calendar events
 * Processes the XML response from Apple's CalDAV server to extract iCal data
 * @param xmlData Raw XML response from CalDAV server containing calendar data
 * @returns Array of parsed calendar events with id, title, date, and time
 */
function parseCalDAVResponse(xmlData: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  
  try {
    console.log('Parsing CalDAV response...');
    
    // Extract iCal data from CDATA sections within calendar-data XML elements
    // Apple returns iCal format wrapped in XML CDATA sections
    const icalMatches = xmlData.match(/<calendar-data[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/calendar-data>/gi);
    
    if (icalMatches) {
      console.log(`Found ${icalMatches.length} calendar entries`);
      
      icalMatches.forEach((match, index) => {
        // Strip XML wrapper to get pure iCal content
        const icalContent = match.replace(/<calendar-data[^>]*><!\[CDATA\[/, '').replace(/\]\]><\/calendar-data>/, '');
        
        try {
          // Parse iCal content using node-ical library
          const parsedCal = parseICS(icalContent);
          
          // Extract VEVENT components (actual calendar events)
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
 * GET /events - Main API endpoint to fetch calendar events
 * Connects to Apple Calendar via CalDAV and returns all events as JSON
 */
app.get('/events', async (req: express.Request, res: express.Response) => {
  try {
    console.log('Fetching events from Apple Calendar...');
    // Make CalDAV request to Apple's servers
    const response = await makeCalDAVRequest();
    
    if (response) {
      // Parse the XML response and extract events
      const events = parseCalDAVResponse(response);
      console.log(`Found ${events.length} events`);
      
      if (events.length > 0) {
        res.json(events);
        return;
      }
    }
    
    // Fallback to demo events if no real events found or connection failed
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
    
    // Return error demo event if something goes wrong
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

// Start the Express server
app.listen(port, () => {
  console.log(`TypeScript CalDAV server listening at http://localhost:${port}`);
});