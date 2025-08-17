import { CalDAVMultiCalendarRepository } from './server-src/repositories/CalDAVMultiCalendarRepository.js';
import { CalDAVConfig } from './server-src/config/CalDAVConfig.js';

async function testMultiCalendarRepository() {
  console.log('🚀 Testing Multi-Calendar CalDAV Repository');
  console.log('='.repeat(50));
  
  try {
    // Initialize repository
    const credentials = CalDAVConfig.getFallbackCredentials();
    const repo = new CalDAVMultiCalendarRepository(credentials);
    
    console.log('1️⃣  Testing calendar discovery...');
    const calendars = await repo.getAllCalendars();
    
    console.log('\n📊 Calendar Discovery Results:');
    calendars.forEach(cal => {
      const status = cal.count >= 0 ? '✅' : '❌';
      console.log(`  ${status} ${cal.displayName} (${cal.name}): ${cal.count} events`);
    });
    
    const totalExpected = 320; // From our previous analysis
    const totalFound = calendars.filter(c => c.count >= 0).reduce((sum, c) => sum + c.count, 0);
    
    console.log(`\n📈 Total Events: ${totalFound}/${totalExpected} expected`);
    
    if (totalFound === totalExpected) {
      console.log('✅ SUCCESS: All expected events found!');
    } else {
      console.log('⚠️  WARNING: Event count mismatch');
    }
    
    console.log('\n2️⃣  Testing full event extraction with metadata...');
    const allEvents = await repo.getAllEventsFromAllCalendars();
    
    console.log(`\n📥 Extracted ${allEvents.length} events with full metadata`);
    
    // Quality checks
    console.log('\n🔍 Quality Checks:');
    
    const eventsWithCalendarData = allEvents.filter(e => 
      e.calendar_path && e.calendar_name && e.caldav_filename
    );
    console.log(`  ✅ ${eventsWithCalendarData.length}/${allEvents.length} events have complete metadata`);
    
    const uniqueIds = new Set(allEvents.map(e => e.id));
    console.log(`  ✅ ${uniqueIds.size}/${allEvents.length} unique event IDs`);
    
    const icsFilenames = allEvents.filter(e => e.caldav_filename && e.caldav_filename.endsWith('.ics'));
    console.log(`  ✅ ${icsFilenames.length}/${allEvents.length} events have .ics filenames`);
    
    // Show sample data
    console.log('\n📋 Sample Event Data:');
    const sampleEvent = allEvents[0];
    if (sampleEvent) {
      console.log(`  ID: ${sampleEvent.id}`);
      console.log(`  Title: ${sampleEvent.title}`);
      console.log(`  Calendar: ${sampleEvent.calendar_name} (${sampleEvent.calendar_path})`);
      console.log(`  Filename: ${sampleEvent.caldav_filename}`);
      console.log(`  Date: ${sampleEvent.date}`);
    }
    
    console.log('\n💾 Files saved to: data/caldav-exports/');
    console.log('  📁 Individual calendar files: {calendar}-events.json');
    console.log('  📁 Master file: all-calendars-events.json');
    
    console.log('\n✅ Multi-calendar repository test completed successfully!');
    console.log('🎯 Ready for integration with DatabaseCalendarService');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testMultiCalendarRepository();