#!/usr/bin/env npx tsx
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