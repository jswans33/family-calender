
const express = require('express');
const cors = require('cors');
const https = require('https');
const ical = require('node-ical');
const config = require('./config.json');

const app = express();
const port = 3001;

app.use(cors());

async function makeCalDAVRequest() {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from('jswans33@gmail.com:qrdq-tahw-xski-ogbf').toString('base64');
    
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

    const options = {
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
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        resolve(data);
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

function parseCalDAVResponse(xmlData) {
  const events = [];
  
  try {
    console.log('Parsing CalDAV response...');
    
    // Extract iCal data using correct namespace
    const icalMatches = xmlData.match(/<calendar-data[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/calendar-data>/gi);
    
    if (icalMatches) {
      console.log(`Found ${icalMatches.length} calendar entries`);
      
      icalMatches.forEach((match, index) => {
        const icalContent = match.replace(/<calendar-data[^>]*><!\[CDATA\[/, '').replace(/\]\]><\/calendar-data>/, '');
        
        try {
          const parsedCal = ical.parseICS(icalContent);
          
          for (let k in parsedCal) {
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

app.get('/events', async (req, res) => {
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
    
    // Fallback to mock events
    const mockEvents = [
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
    
    const mockEvents = [
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
