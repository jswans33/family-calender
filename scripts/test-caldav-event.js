#!/usr/bin/env node

import https from 'https';
import dotenv from 'dotenv';
dotenv.config();

const username = process.env.CALDAV_USERNAME;
const password = process.env.CALDAV_PASSWORD;
const auth = Buffer.from(`${username}:${password}`).toString('base64');

const requestBody = `<?xml version="1.0" encoding="UTF-8"?>
<C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop xmlns:D="DAV:">
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
</C:calendar-query>`;

const options = {
  hostname: 'p19-caldav.icloud.com',
  path: '/1110188709/calendars/0C9AAF81-90AD-4D40-8E93-A8D6A925ECDF/',
  method: 'REPORT',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/xml',
    'Content-Length': Buffer.byteLength(requestBody)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    // Find PD lunch event
    const pdLunchMatch = data.match(/BEGIN:VEVENT[\s\S]*?SUMMARY:PD lunch[\s\S]*?END:VEVENT/);
    if (pdLunchMatch) {
      console.log('Found PD lunch event:');
      console.log(pdLunchMatch[0]);
      
      // Parse DTSTART
      const dtStartMatch = pdLunchMatch[0].match(/DTSTART[^:]*:(.*)/);
      if (dtStartMatch) {
        console.log('\nDTSTART:', dtStartMatch[1]);
      }
      
      // Parse DTEND
      const dtEndMatch = pdLunchMatch[0].match(/DTEND[^:]*:(.*)/);
      if (dtEndMatch) {
        console.log('DTEND:', dtEndMatch[1]);
      }
    } else {
      console.log('PD lunch event not found');
      // Show first event as example
      const firstEvent = data.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/);
      if (firstEvent) {
        console.log('Example event:');
        console.log(firstEvent[0]);
      }
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(requestBody);
req.end();