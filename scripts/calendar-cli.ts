#!/usr/bin/env npx tsx
/**
 * DEBUG METADATA FOR CLI EVENT CREATION - SUCCESSFULLY RESOLVED ✅
 * 
 * ROOT CAUSES IDENTIFIED AND FIXED:
 * 1. BYPASS ISSUE: CLI called CalDAV directly while frontend used server API
 *    - FIXED: Changed CLI to use POST /events endpoint like frontend
 * 
 * 2. PAYLOAD ISSUE: CLI sent complex event object with metadata that caused CalDAV 403
 *    - FIXED: Simplified event object to match frontend's minimal structure
 * 
 * WORKING SOLUTION:
 * - CLI now uses: HTTP API (POST /events) + Simple payload (id, title, date, time, calendar_name)
 * - Frontend uses: Same HTTP API + Same simple payload structure
 * - Both routes: Server → DatabaseCalendarService.createEventInCalendar() → Success
 * 
 * VERIFICATION:
 * - ✅ CLI creates events successfully (temp-1755411030607 created in home calendar)
 * - ✅ Events persist after sync (no longer deleted during CalDAV refresh)
 * - ✅ Both CLI and frontend use identical authentication and error handling
 * 
 * LESSON LEARNED:
 * - Complex metadata (dtend, duration, status, created, lastModified, sequence) can trigger CalDAV auth issues
 * - Always test with minimal working payload first, then add complexity gradually
 * - Use same API endpoints and payload structure as proven working code paths
 * 
 * TODO - FUTURE ENHANCEMENTS:
 * - Add duration/end time support back to CLI (test dtend field gradually)
 * - Ensure server API properly handles duration calculations
 * - Add support for recurring events (RRULE)
 * - Add support for event categories/tags
 */

import { Command } from 'commander';
import { CalDAVMultiCalendarRepository } from '../server-src/repositories/CalDAVMultiCalendarRepository.js';
import { CalDAVConfig } from '../server-src/config/CalDAVConfig.js';

const program = new Command();
const repo = new CalDAVMultiCalendarRepository(CalDAVConfig.getFallbackCredentials());

// Calendar names for testing
const CALENDARS = ['home', 'work', 'shared', 'meals'];

program
  .name('calendar-cli')
  .description('CLI for testing calendar CRUD operations')
  .version('1.0.0');

// CREATE-EVENT command for custom events
program
  .command('create-event')
  .description('Create a custom event')
  .requiredOption('-t, --title <title>', 'event title')
  .requiredOption('-d, --date <date>', 'event date (YYYY-MM-DD)')
  .requiredOption('-c, --calendar <name>', 'calendar name (home, work, shared, meals)')
  .option('--time <time>', 'event time (HH:MM)', '09:00')
  .option('--duration <minutes>', 'duration in minutes', '60')
  .option('--description <desc>', 'event description', '')
  .option('--location <location>', 'event location', '')
  .option('--local-only', 'save only to local database, skip CalDAV', false)
  .action(async (options) => {
    console.log('📅 CREATING CUSTOM EVENT');
    console.log('=' .repeat(30));
    
    const { title, date, calendar, time, duration, description, location } = options;
    
    // Create event with minimal payload (matches frontend)
    const event = {
      id: `temp-${Date.now()}`,  // Use temp- prefix like frontend
      title,
      date,
      time,
      calendar_name: calendar,
      ...(description && { description }),
      ...(location && { location })
    };

    try {
      console.log(`📅 Creating "${title}" in ${calendar} calendar...`);
      console.log(`   Date: ${date} at ${time}`);
      console.log(`   Duration: ${duration} minutes`);
      
      if (options.localOnly) {
        // Direct SQLite insertion using sqlite3 command
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        
        const sql = `INSERT INTO events (id, title, date, time, dtend, location, description, calendar_name, categories) 
                     VALUES ('${event.id}', '${event.title}', '${event.date}', '${event.time}', '${event.dtend}', 
                             '${event.location || ''}', '${event.description || ''}', '${event.calendar_name}', '[]');`;
        
        try {
          await execAsync(`sqlite3 /home/james/projects/swanson-light/data/calendar.db "${sql}"`);
          console.log(`✅ SUCCESS: Event "${title}" saved to local database with ID: ${event.id}`);
        } catch (error) {
          console.error(`❌ ERROR saving to database:`, error);
        }
      } else {
        // Use same HTTP API endpoint as frontend
        try {
          const response = await fetch('http://localhost:3001/events', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          });

          if (response.ok) {
            const result = await response.json();
            console.log(`✅ SUCCESS: Event "${title}" created in ${calendar} calendar`);
            console.log(`   ID: ${event.id}`);
            console.log(`   Server response:`, result);
          } else {
            console.log(`❌ FAILED: HTTP ${response.status} ${response.statusText}`);
            const error = await response.text();
            console.log(`   Error: ${error}`);
          }
        } catch (fetchError) {
          console.error(`❌ ERROR: Failed to reach server:`, fetchError);
        }
      }
    } catch (error) {
      console.error(`❌ ERROR creating event in ${calendar}:`, error);
    }
  });

// CREATE command
program
  .command('create')
  .description('Create test events in all calendars')
  .option('-c, --calendar <name>', 'specific calendar to test')
  .action(async (options) => {
    console.log('🍽️  CREATING TEST EVENTS');
    console.log('=' .repeat(50));
    
    const calendarsToTest = options.calendar ? [options.calendar] : CALENDARS;
    const timestamp = Date.now();
    
    for (const calendar of calendarsToTest) {
      const event = {
        id: `cli-test-${calendar}-${timestamp}`,
        title: `CLI Test Event - ${calendar.toUpperCase()}`,
        date: '2025-08-21',
        time: '14:00',
        description: `Test event created via CLI for ${calendar} calendar`,
        dtend: '2025-08-21T15:00:00.000Z'
      };

      try {
        console.log(`📅 Creating event in ${calendar} calendar...`);
        const success = await repo.createEventInCalendar(event, calendar);
        
        if (success) {
          console.log(`✅ SUCCESS: Event created in ${calendar} calendar`);
          console.log(`   ID: ${event.id}`);
          console.log(`   Title: ${event.title}`);
        } else {
          console.log(`❌ FAILED: Could not create event in ${calendar} calendar`);
        }
      } catch (error) {
        console.error(`❌ ERROR creating in ${calendar}:`, error);
      }
      
      console.log(''); // spacing
    }
  });

// READ command
program
  .command('read')
  .description('Read events from all calendars')
  .option('-c, --calendar <name>', 'specific calendar to read')
  .action(async (options) => {
    console.log('📖 READING CALENDAR EVENTS');
    console.log('=' .repeat(50));
    
    try {
      if (options.calendar) {
        // Read specific calendar
        console.log(`📅 Reading ${options.calendar} calendar...`);
        const allEvents = await repo.getAllEventsFromAllCalendars();
        const events = allEvents.filter(e => e.calendar_name === options.calendar);
        console.log(`Found ${events.length} events in ${options.calendar}`);
        
        events.slice(0, 5).forEach(event => {
          console.log(`  - ${event.title} (${event.date})`);
        });
      } else {
        // Read all calendars
        const allCalendars = await repo.getAllCalendars();
        allCalendars.forEach(cal => {
          console.log(`📅 ${cal.displayName}: ${cal.count} events`);
        });
        
        const allEvents = await repo.getAllEventsFromAllCalendars();
        console.log(`\n📊 Total events across all calendars: ${allEvents.length}`);
      }
    } catch (error) {
      console.error('❌ ERROR reading calendars:', error);
    }
  });

// UPDATE command  
program
  .command('update')
  .description('Update test events')
  .argument('<eventId>', 'event ID to update')
  .option('-c, --calendar <name>', 'calendar containing the event')
  .action(async (eventId, options) => {
    console.log('✏️  UPDATING EVENT');
    console.log('=' .repeat(50));
    
    if (!options.calendar) {
      console.error('❌ Calendar name required for update operation');
      return;
    }

    const updatedEvent = {
      id: eventId,
      title: `UPDATED: CLI Test Event - ${options.calendar.toUpperCase()}`,
      date: '2025-08-21',
      time: '15:30',
      description: `Updated test event via CLI for ${options.calendar} calendar`,
      dtend: '2025-08-21T16:30:00.000Z'
    };

    try {
      console.log(`📝 Updating event ${eventId} in ${options.calendar}...`);
      const success = await repo.createEventInCalendar(updatedEvent, options.calendar);
      
      if (success) {
        console.log(`✅ SUCCESS: Event updated in ${options.calendar} calendar`);
        console.log(`   New Title: ${updatedEvent.title}`);
      } else {
        console.log(`❌ FAILED: Could not update event in ${options.calendar}`);
      }
    } catch (error) {
      console.error(`❌ ERROR updating event:`, error);
    }
  });

// DELETE command
program
  .command('delete')
  .description('Delete test events')
  .argument('<eventId>', 'event ID to delete')
  .option('-c, --calendar <name>', 'calendar containing the event')
  .action(async (eventId, options) => {
    console.log('🗑️  DELETING EVENT');
    console.log('=' .repeat(50));
    
    if (!options.calendar) {
      console.error('❌ Calendar name required for delete operation');
      return;
    }

    try {
      console.log(`🗑️  Deleting event ${eventId} from ${options.calendar}...`);
      
      // Use direct CalDAV delete
      const calendar = repo['calendars'].find((cal: any) => cal.name === options.calendar);
      if (!calendar) {
        console.error(`❌ Calendar ${options.calendar} not found`);
        return;
      }

      const url = `https://${repo['credentials'].hostname}${repo['basePath']}${calendar.path}${eventId}.ics`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${repo['credentials'].username}:${repo['credentials'].password}`).toString('base64')}`
        }
      });

      if (response.ok || response.status === 404) {
        console.log(`✅ SUCCESS: Event deleted from ${options.calendar} calendar`);
      } else {
        console.log(`❌ FAILED: Delete returned status ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ ERROR deleting event:`, error);
    }
  });

// FULL TEST command
program
  .command('test-all')
  .description('Run full CRUD test on all calendars')
  .action(async () => {
    console.log('🧪 FULL CRUD TEST SUITE');
    console.log('=' .repeat(50));
    
    const timestamp = Date.now();
    const testEvents: Record<string, string> = {};
    
    // 1. CREATE phase
    console.log('\n📝 PHASE 1: CREATE');
    console.log('-' .repeat(30));
    
    for (const calendar of CALENDARS) {
      const eventId = `cli-full-test-${calendar}-${timestamp}`;
      testEvents[calendar] = eventId;
      
      const event = {
        id: eventId,
        title: `Full Test - ${calendar.toUpperCase()}`,
        date: '2025-08-22',
        time: '10:00',
        description: `Full CRUD test event for ${calendar}`,
        dtend: '2025-08-22T11:00:00.000Z'
      };

      try {
        const success = await repo.createEventInCalendar(event, calendar);
        console.log(`${success ? '✅' : '❌'} CREATE ${calendar}: ${success ? 'SUCCESS' : 'FAILED'}`);
      } catch (error) {
        console.log(`❌ CREATE ${calendar}: ERROR`);
      }
    }
    
    // 2. READ phase
    console.log('\n📖 PHASE 2: READ');
    console.log('-' .repeat(30));
    
    try {
      const allCalendars = await repo.getAllCalendars();
      allCalendars.forEach(cal => {
        console.log(`✅ READ ${cal.name}: ${cal.count} events found`);
      });
    } catch (error) {
      console.log('❌ READ: ERROR');
    }
    
    // 3. UPDATE phase
    console.log('\n✏️  PHASE 3: UPDATE');
    console.log('-' .repeat(30));
    
    for (const calendar of CALENDARS) {
      const eventId = testEvents[calendar];
      const updatedEvent = {
        id: eventId,
        title: `UPDATED Full Test - ${calendar.toUpperCase()}`,
        date: '2025-08-22',
        time: '11:30',
        description: `Updated full CRUD test event for ${calendar}`,
        dtend: '2025-08-22T12:30:00.000Z'
      };

      try {
        const success = await repo.createEventInCalendar(updatedEvent, calendar);
        console.log(`${success ? '✅' : '❌'} UPDATE ${calendar}: ${success ? 'SUCCESS' : 'FAILED'}`);
      } catch (error) {
        console.log(`❌ UPDATE ${calendar}: ERROR`);
      }
    }
    
    // 4. DELETE phase
    console.log('\n🗑️  PHASE 4: DELETE');
    console.log('-' .repeat(30));
    
    for (const calendar of CALENDARS) {
      const eventId = testEvents[calendar];
      
      try {
        const calendarObj = repo['calendars'].find((cal: any) => cal.name === calendar);
        const url = `https://${repo['credentials'].hostname}${repo['basePath']}${calendarObj.path}${eventId}.ics`;
        
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${repo['credentials'].username}:${repo['credentials'].password}`).toString('base64')}`
          }
        });

        const success = response.ok || response.status === 404;
        console.log(`${success ? '✅' : '❌'} DELETE ${calendar}: ${success ? 'SUCCESS' : 'FAILED'}`);
      } catch (error) {
        console.log(`❌ DELETE ${calendar}: ERROR`);
      }
    }
    
    console.log('\n🎯 FULL CRUD TEST COMPLETE');
  });

// LIST command
program
  .command('list')
  .description('List all available calendars')
  .action(async () => {
    console.log('📋 AVAILABLE CALENDARS');
    console.log('=' .repeat(50));
    
    try {
      const calendars = await repo.getAllCalendars();
      calendars.forEach((cal, index) => {
        console.log(`${index + 1}. ${cal.displayName} (${cal.name})`);
        console.log(`   Events: ${cal.count}`);
        console.log(`   Path: ${cal.path}`);
        console.log('');
      });
    } catch (error) {
      console.error('❌ ERROR listing calendars:', error);
    }
  });

program.parse();