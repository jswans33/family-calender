#!/usr/bin/env node

const http = require('http');

const eventData = {
  title: "Direct Test Event",
  start: "2025-08-20T17:30:00.000Z",
  end: "2025-08-20T18:30:00.000Z",
  description: "Testing event creation directly"
};

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/events',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(JSON.stringify(eventData))
  }
};

console.log('Sending event:', eventData);

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response:', data);
    
    if (res.statusCode !== 201 && res.statusCode !== 200) {
      console.log('\n❌ Event creation failed!');
      console.log('This likely means:');
      console.log('1. CalDAV authentication failed');
      console.log('2. Calendar path is incorrect');
      console.log('3. iCal format is invalid');
      console.log('4. Network/permission issue');
    } else {
      console.log('\n✅ Event created successfully!');
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.write(JSON.stringify(eventData));
req.end();