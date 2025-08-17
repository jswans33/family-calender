import { CalDAVMultiCalendarRepository } from './server-src/repositories/CalDAVMultiCalendarRepository.js';
import { CalDAVConfig } from './server-src/config/CalDAVConfig.js';

async function demoSpecificCalendarAccess() {
  console.log('🎯 DEMO: How to pull data from SPECIFIC calendars');
  console.log('='.repeat(55));

  const credentials = CalDAVConfig.getFallbackCredentials();
  const repo = new CalDAVMultiCalendarRepository(credentials);

  // Demo 1: Pull data from just HOME calendar
  console.log('\\n1️⃣  PULLING ONLY HOME CALENDAR DATA\\n');
  try {
    const homeXmlData = await repo.fetchCalendarData('/home/');
    const homeEvents = repo.parseCalendarEvents(homeXmlData);

    console.log(`📅 Found ${homeEvents.length} events in HOME calendar:`);
    homeEvents.slice(0, 5).forEach((event, index) => {
      console.log(
        `   ${index + 1}. ${event.title} (${new Date(event.date).toLocaleDateString()})`
      );
    });
    if (homeEvents.length > 5) {
      console.log(`   ... and ${homeEvents.length - 5} more events`);
    }
  } catch (error) {
    console.error('❌ Error fetching HOME calendar:', error);
  }

  // Demo 2: Pull data from just WORK calendar
  console.log('\\n2️⃣  PULLING ONLY WORK CALENDAR DATA\\n');
  try {
    const workXmlData = await repo.fetchCalendarData('/work/');
    const workEvents = repo.parseCalendarEvents(workXmlData);

    console.log(`💼 Found ${workEvents.length} events in WORK calendar:`);
    workEvents.slice(0, 5).forEach((event, index) => {
      console.log(
        `   ${index + 1}. ${event.title} (${new Date(event.date).toLocaleDateString()})`
      );
    });
    if (workEvents.length > 5) {
      console.log(`   ... and ${workEvents.length - 5} more events`);
    }
  } catch (error) {
    console.error('❌ Error fetching WORK calendar:', error);
  }

  // Demo 3: Pull data from just SHARED calendar
  console.log('\\n3️⃣  PULLING ONLY SHARED CALENDAR DATA\\n');
  try {
    const sharedXmlData = await repo.fetchCalendarData(
      '/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/'
    );
    const sharedEvents = repo.parseCalendarEvents(sharedXmlData);

    console.log(`🤝 Found ${sharedEvents.length} events in SHARED calendar:`);
    sharedEvents.forEach((event, index) => {
      console.log(
        `   ${index + 1}. ${event.title} (${new Date(event.date).toLocaleDateString()})`
      );
      console.log(
        `      📝 Description: ${event.description || 'No description'}`
      );
      console.log(`      📍 Location: ${event.location || 'No location'}`);
    });
  } catch (error) {
    console.error('❌ Error fetching SHARED calendar:', error);
  }

  // Demo 4: Pull data from just MEALS calendar
  console.log('\\n4️⃣  PULLING ONLY MEALS CALENDAR DATA\\n');
  try {
    const mealsXmlData = await repo.fetchCalendarData(
      '/1fa1e4097e27af6d41607163c20c088e70cf8e9db9d71b1a62611ec364123914/'
    );
    const mealsEvents = repo.parseCalendarEvents(mealsXmlData);

    console.log(`🍽️  Found ${mealsEvents.length} events in MEALS calendar:`);
    mealsEvents.forEach((event, index) => {
      console.log(
        `   ${index + 1}. ${event.title} (${new Date(event.date).toLocaleDateString()})`
      );
      console.log(
        `      📝 Description: ${event.description || 'No description'}`
      );
    });
  } catch (error) {
    console.error('❌ Error fetching MEALS calendar:', error);
  }

  // Demo 5: Show how to create events in specific calendars
  console.log('\\n5️⃣  HOW TO CREATE EVENTS IN SPECIFIC CALENDARS\\n');

  const sampleEvent = {
    id: `demo-${Date.now()}`,
    title: 'Demo Event',
    date: new Date().toISOString(),
    time: '2:00 PM',
    description: 'This is a demo event',
  };

  console.log('📝 Code examples for creating events:');
  console.log('');
  console.log('// Create in HOME calendar:');
  console.log('await repo.createEvent(sampleEvent, "/home/")');
  console.log('');
  console.log('// Create in WORK calendar:');
  console.log('await repo.createEvent(sampleEvent, "/work/")');
  console.log('');
  console.log('// Create in SHARED calendar:');
  console.log(
    'await repo.createEvent(sampleEvent, "/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/")'
  );
  console.log('');
  console.log('// Create in MEALS calendar:');
  console.log(
    'await repo.createEvent(sampleEvent, "/1fa1e4097e27af6d41607163c20c088e70cf8e9db9d71b1a62611ec364123914/")'
  );

  // Demo 6: Show how to get events with filename for deletion
  console.log('\\n6️⃣  HOW TO GET EVENTS WITH FILENAMES FOR DELETION\\n');

  try {
    console.log('📁 Getting events with filenames from SHARED calendar:');
    const sharedXmlData = await repo.fetchCalendarData(
      '/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/'
    );
    const sharedEventsWithFilenames =
      repo.parseCalendarEventsWithFilenames(sharedXmlData);

    sharedEventsWithFilenames.forEach((item, index) => {
      console.log(`   ${index + 1}. Event: "${item.event.title}"`);
      console.log(`      📄 Filename: ${item.filename}`);
      console.log(
        `      🗑️  Delete code: await repo.deleteEvent("${item.event.id}", "/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/", "${item.filename}")`
      );
    });
  } catch (error) {
    console.error('❌ Error getting events with filenames:', error);
  }

  console.log(
    '\\n🎯 SUMMARY: You can now pull data from any specific calendar:'
  );
  console.log('   • HOME: /home/ (273 events)');
  console.log('   • WORK: /work/ (43 events)');
  console.log('   • SHARED: /2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/ (1 event)');
  console.log(
    '   • MEALS: /1fa1e4097e27af6d41607163c20c088e70cf8e9db9d71b1a62611ec364123914/ (1 event)'
  );
  console.log(
    '\\n✅ Each calendar can be accessed independently with full CRUD operations!'
  );
}

demoSpecificCalendarAccess();
