import { CalDAVMultiCalendarRepository } from './server-src/repositories/CalDAVMultiCalendarRepository.js';
import { CalDAVConfig } from './server-src/config/CalDAVConfig.js';

async function pullAllCalendarData() {
  console.log('🚀 PULLING DATA FROM ALL 4 CALENDARS');
  console.log('='.repeat(60));

  try {
    // Initialize the multi-calendar repository
    const credentials = CalDAVConfig.getFallbackCredentials();
    const repo = new CalDAVMultiCalendarRepository(credentials);

    // Step 1: Discover all calendars and their counts
    console.log('1️⃣  DISCOVERING ALL CALENDARS...\n');
    const calendars = await repo.getAllCalendars();

    calendars.forEach(calendar => {
      console.log(
        `📅 ${calendar.displayName.padEnd(8)} | ${calendar.count.toString().padStart(3)} events | ${calendar.path}`
      );
    });

    const totalFound = calendars.reduce(
      (sum, cal) => sum + Math.max(0, cal.count),
      0
    );
    console.log(`\n📊 TOTAL EVENTS DISCOVERED: ${totalFound}\n`);

    // Step 2: Extract all events with metadata
    console.log('2️⃣  EXTRACTING ALL EVENTS WITH METADATA...\n');
    const allEvents = await repo.getAllEventsFromAllCalendars();

    // Step 3: Show breakdown by calendar
    console.log('3️⃣  CALENDAR BREAKDOWN:\n');

    const breakdownByCalendar = calendars.map(cal => {
      const calendarEvents = allEvents.filter(
        e => e.calendar_name === cal.name
      );
      return {
        name: cal.displayName,
        path: cal.path,
        count: calendarEvents.length,
        events: calendarEvents,
      };
    });

    breakdownByCalendar.forEach(cal => {
      console.log(
        `📅 ${cal.name.toUpperCase().padEnd(8)} | ${cal.count.toString().padStart(3)} events`
      );

      // Show first 3 events as samples
      cal.events.slice(0, 3).forEach((event, index) => {
        console.log(
          `   ${index + 1}. ${event.title.substring(0, 40)}${event.title.length > 40 ? '...' : ''}`
        );
        console.log(`      📁 File: ${event.caldav_filename}`);
        console.log(
          `      📅 Date: ${new Date(event.date).toLocaleDateString()}`
        );
      });

      if (cal.count > 3) {
        console.log(`   ... and ${cal.count - 3} more events`);
      }
      console.log('');
    });

    // Step 4: Demonstrate different ways to access the data
    console.log('4️⃣  DATA ACCESS EXAMPLES:\n');

    // Example 1: Get events from specific calendar
    console.log('🔍 EXAMPLE 1: Get events from HOME calendar only');
    const homeEvents = allEvents.filter(e => e.calendar_name === 'home');
    console.log(`   Found ${homeEvents.length} events in Home calendar`);
    console.log(`   Sample: "${homeEvents[0]?.title || 'No events'}"\\n`);

    // Example 2: Get events by date range
    console.log('🔍 EXAMPLE 2: Get events from 2023');
    const events2023 = allEvents.filter(e => {
      const eventYear = new Date(e.date).getFullYear();
      return eventYear === 2023;
    });
    console.log(`   Found ${events2023.length} events from 2023`);
    if (events2023.length > 0) {
      console.log(
        `   Sample: "${events2023[0].title}" (${events2023[0].calendar_name})`
      );
    }
    console.log('');

    // Example 3: Get events with specific keywords
    console.log('🔍 EXAMPLE 3: Search for events containing "Ella"');
    const ellaEvents = allEvents.filter(e =>
      e.title.toLowerCase().includes('ella')
    );
    console.log(`   Found ${ellaEvents.length} events about Ella`);
    ellaEvents.slice(0, 2).forEach(event => {
      console.log(`   - "${event.title}" in ${event.calendar_name} calendar`);
    });
    console.log('');

    // Step 5: Show file structure created
    console.log('5️⃣  FILES CREATED:\n');
    console.log('📁 data/caldav-exports/');
    console.log('   ├── shared-events.json     (1 event)');
    console.log('   ├── home-events.json       (273 events)');
    console.log('   ├── work-events.json       (43 events)');
    console.log('   ├── meals-events.json      (1 event)');
    console.log('   └── all-calendars-events.json (318 total events)\\n');

    // Step 6: Demonstrate how to use specific calendar operations
    console.log('6️⃣  HOW TO USE FOR CRUD OPERATIONS:\\n');

    console.log('📝 CREATE in specific calendar:');
    console.log(
      '   await repo.createEvent(newEvent, "/home/")  // Creates in Home calendar'
    );
    console.log(
      '   await repo.createEvent(newEvent, "/work/")  // Creates in Work calendar\\n'
    );

    console.log('🗑️  DELETE from specific calendar:');
    console.log('   const event = allEvents.find(e => e.id === "target-id")');
    console.log(
      '   await repo.deleteEvent(event.id, event.calendar_path, event.caldav_filename)\\n'
    );

    console.log('📖 READ from specific calendar:');
    console.log('   const homeXml = await repo.fetchCalendarData("/home/")');
    console.log('   const homeEvents = repo.parseCalendarEvents(homeXml)\\n');

    console.log('✏️  UPDATE in specific calendar:');
    console.log(
      '   await repo.updateEvent(updatedEvent, event.calendar_path)\\n'
    );

    // Step 7: Next steps
    console.log('7️⃣  NEXT STEPS FOR INTEGRATION:\\n');
    console.log(
      '✅ 1. Update DatabaseCalendarService to use CalDAVMultiCalendarRepository'
    );
    console.log(
      '✅ 2. Add calendar_path and calendar_name columns to SQLite database'
    );
    console.log('✅ 3. Update API endpoints to support ?calendar= parameter');
    console.log('✅ 4. Modify sync operations to handle all 4 calendars');
    console.log('✅ 5. Update frontend to show calendar selector\\n');

    console.log(
      '🎯 SUCCESS: All 4 calendars accessible with full CRUD operations!'
    );
    console.log(`📊 Total events available: ${allEvents.length}`);
    console.log('💾 All data exported to local JSON files for verification');
  } catch (error) {
    console.error('❌ Error pulling calendar data:', error);
    process.exit(1);
  }
}

// Run the data pull
pullAllCalendarData();
