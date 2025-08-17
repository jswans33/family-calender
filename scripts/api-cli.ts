#!/usr/bin/env npx tsx
import { Command } from 'commander';
import { Buffer } from 'buffer';

const program = new Command();
const API_BASE = 'http://localhost:3001';

// Calendar names for testing
const CALENDARS = ['home', 'work', 'shared', 'meals'];

program
  .name('api-cli')
  .description('CLI for testing calendar CRUD operations via API')
  .version('1.0.0');

// CREATE command
program
  .command('create')
  .description('Create test events via API')
  .option('-c, --calendar <name>', 'specific calendar to test')
  .action(async options => {
    console.log('🍽️  CREATING TEST EVENTS VIA API');
    console.log('='.repeat(50));

    const calendarsToTest = options.calendar ? [options.calendar] : CALENDARS;
    const timestamp = Date.now();

    for (const calendar of calendarsToTest) {
      const event = {
        id: `api-test-${calendar}-${timestamp}`,
        title: `API Test Event - ${calendar.toUpperCase()}`,
        date: '2025-08-22',
        time: '14:00',
        description: `Test event created via API for ${calendar} calendar`,
        calendar_name: calendar,
      };

      try {
        console.log(`📅 Creating event in ${calendar} calendar via API...`);

        const response = await fetch(`${API_BASE}/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          console.log(`✅ SUCCESS: Event created in ${calendar} calendar`);
          console.log(`   ID: ${event.id}`);
          console.log(`   Title: ${event.title}`);
        } else {
          console.log(
            `❌ FAILED: Could not create event in ${calendar} calendar`
          );
          console.log(`   Error: ${result.message || result.error}`);
        }
      } catch {
      }

      console.log(''); // spacing
    }
  });

// READ command
program
  .command('read')
  .description('Read events from all calendars via API')
  .option('-c, --calendar <name>', 'specific calendar to read')
  .action(async options => {
    console.log('📖 READING CALENDAR EVENTS VIA API');
    console.log('='.repeat(50));

    try {
      if (options.calendar) {
        // Read specific calendar
        console.log(`📅 Reading ${options.calendar} calendar...`);
        const response = await fetch(
          `${API_BASE}/events?calendar=${options.calendar}`
        );
        const events = await response.json();
        console.log(`Found ${events.length} events in ${options.calendar}`);

        events.slice(0, 5).forEach((event: any) => {
          console.log(
            `  - ${event.title} (${event.date}) ${event.calendar_name ? `[${event.calendar_name}]` : ''}`
          );
        });
      } else {
        // Read all calendars
        const calResponse = await fetch(`${API_BASE}/calendars`);
        const calendars = await calResponse.json();

        console.log('📊 Calendar Summary:');
        calendars.forEach((cal: any) => {
          console.log(`  📅 ${cal.name}: ${cal.count} events`);
        });

        const allResponse = await fetch(`${API_BASE}/events`);
        const allEvents = await allResponse.json();
        console.log(
          `\n📊 Total events accessible via API: ${allEvents.length}`
        );
      }
    } catch {
    }
  });

// UPDATE command
program
  .command('update')
  .description('Update test events via API')
  .argument('<eventId>', 'event ID to update')
  .action(async eventId => {
    console.log('✏️  UPDATING EVENT VIA API');
    console.log('='.repeat(50));

    const updatedEvent = {
      id: eventId,
      title: `UPDATED: API Test Event`,
      date: '2025-08-22',
      time: '15:30',
      description: `Updated test event via API`,
    };

    try {
      console.log(`📝 Updating event ${eventId}...`);

      // Encode the event ID for URL
      const encodedId = Buffer.from(eventId)
        .toString('base64')
        .replace(/[+/=]/g, match => {
          return { '+': '-', '/': '_', '=': '' }[match] || match;
        });

      const response = await fetch(`${API_BASE}/events/${encodedId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedEvent),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log(`✅ SUCCESS: Event updated`);
        console.log(`   New Title: ${updatedEvent.title}`);
      } else {
        console.log(`❌ FAILED: Could not update event`);
        console.log(`   Error: ${result.message || result.error}`);
      }
    } catch {
    }
  });

// DELETE command
program
  .command('delete')
  .description('Delete test events via API')
  .argument('<eventId>', 'event ID to delete')
  .action(async eventId => {
    console.log('🗑️  DELETING EVENT VIA API');
    console.log('='.repeat(50));

    try {
      console.log(`🗑️  Deleting event ${eventId}...`);

      // Encode the event ID for URL
      const encodedId = Buffer.from(eventId)
        .toString('base64')
        .replace(/[+/=]/g, match => {
          return { '+': '-', '/': '_', '=': '' }[match] || match;
        });

      const response = await fetch(`${API_BASE}/events/${encodedId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log(`✅ SUCCESS: Event deleted`);
      } else {
        console.log(`❌ FAILED: Could not delete event`);
        console.log(`   Error: ${result.message || result.error}`);
      }
    } catch {
    }
  });

// FULL TEST command
program
  .command('test-all')
  .description('Run full CRUD test on all calendars via API')
  .action(async () => {
    console.log('🧪 FULL CRUD TEST SUITE VIA API');
    console.log('='.repeat(50));

    const timestamp = Date.now();
    const testEvents: Record<string, string> = {};

    // 1. CREATE phase
    console.log('\n📝 PHASE 1: CREATE');
    console.log('-'.repeat(30));

    for (const calendar of CALENDARS) {
      const eventId = `api-full-test-${calendar}-${timestamp}`;
      testEvents[calendar] = eventId;

      const event = {
        id: eventId,
        title: `API Full Test - ${calendar.toUpperCase()}`,
        date: '2025-08-23',
        time: '10:00',
        description: `Full CRUD test event for ${calendar} via API`,
        calendar_name: calendar,
      };

      try {
        const response = await fetch(`${API_BASE}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        });
        const result = await response.json();
        const success = response.ok && result.success;
        console.log(
          `${success ? '✅' : '❌'} CREATE ${calendar}: ${success ? 'SUCCESS' : 'FAILED'}`
        );
      } catch {
        console.log(`❌ CREATE ${calendar}: ERROR`);
      }
    }

    // 2. READ phase
    console.log('\n📖 PHASE 2: READ');
    console.log('-'.repeat(30));

    try {
      const response = await fetch(`${API_BASE}/calendars`);
      const calendars = await response.json();
      calendars.forEach((cal: any) => {
        console.log(`✅ READ ${cal.name}: ${cal.count} events found`);
      });
    } catch {
      console.log('❌ READ: ERROR');
    }

    // 3. UPDATE phase
    console.log('\n✏️  PHASE 3: UPDATE');
    console.log('-'.repeat(30));

    for (const calendar of CALENDARS) {
      const eventId = testEvents[calendar];
      const updatedEvent = {
        id: eventId,
        title: `UPDATED API Full Test - ${calendar.toUpperCase()}`,
        date: '2025-08-23',
        time: '11:30',
        description: `Updated full CRUD test event for ${calendar} via API`,
      };

      try {
        const encodedId = Buffer.from(eventId)
          .toString('base64')
          .replace(/[+/=]/g, match => {
            return { '+': '-', '/': '_', '=': '' }[match] || match;
          });

        const response = await fetch(`${API_BASE}/events/${encodedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedEvent),
        });
        const result = await response.json();
        const success = response.ok && result.success;
        console.log(
          `${success ? '✅' : '❌'} UPDATE ${calendar}: ${success ? 'SUCCESS' : 'FAILED'}`
        );
      } catch {
        console.log(`❌ UPDATE ${calendar}: ERROR`);
      }
    }

    // 4. DELETE phase
    console.log('\n🗑️  PHASE 4: DELETE');
    console.log('-'.repeat(30));

    for (const calendar of CALENDARS) {
      const eventId = testEvents[calendar];

      try {
        const encodedId = Buffer.from(eventId)
          .toString('base64')
          .replace(/[+/=]/g, match => {
            return { '+': '-', '/': '_', '=': '' }[match] || match;
          });

        const response = await fetch(`${API_BASE}/events/${encodedId}`, {
          method: 'DELETE',
        });
        const result = await response.json();
        const success = response.ok && result.success;
        console.log(
          `${success ? '✅' : '❌'} DELETE ${calendar}: ${success ? 'SUCCESS' : 'FAILED'}`
        );
      } catch {
        console.log(`❌ DELETE ${calendar}: ERROR`);
      }
    }

    console.log('\n🎯 FULL CRUD TEST COMPLETE VIA API');
  });

program.parse();
