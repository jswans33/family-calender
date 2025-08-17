import { CalDAVMultiCalendarRepository } from './server-src/repositories/CalDAVMultiCalendarRepository.js';
import { CalDAVConfig } from './server-src/config/CalDAVConfig.js';

async function testCRUDAllCalendars() {
  console.log('🧪 CRUD OPERATIONS PROOF TEST');
  console.log('='.repeat(50));
  console.log('Testing CREATE, READ, UPDATE, DELETE on all 4 calendars\n');

  const repo = new CalDAVMultiCalendarRepository(
    CalDAVConfig.getFallbackCredentials()
  );
  const testResults = {
    create: { home: false, work: false, shared: false, meals: false },
    read: { home: false, work: false, shared: false, meals: false },
    update: { home: false, work: false, shared: false, meals: false },
    delete: { home: false, work: false, shared: false, meals: false },
  };

  const testEvents: any = {};

  try {
    // BASELINE: Get current state
    console.log('📊 PHASE 0: BASELINE STATE');
    console.log('-'.repeat(30));
    const baseline = await repo.getAllCalendars();
    baseline.forEach(cal => {
      console.log(`📅 ${cal.displayName}: ${cal.count} events`);
    });
    const baselineTotal = baseline.reduce((sum, cal) => sum + cal.count, 0);
    console.log(`📊 Total baseline events: ${baselineTotal}\n`);

    // PHASE 1: CREATE Test Events
    console.log('📝 PHASE 1: CREATE OPERATIONS TEST');
    console.log('-'.repeat(30));

    const timestamp = Date.now();

    // Create in HOME calendar
    testEvents.home = {
      id: `crud-test-home-${timestamp}`,
      title: 'CRUD Test Event - Home',
      date: new Date('2025-08-20T10:00:00.000Z').toISOString(),
      time: '10:00',
      description: 'Testing CRUD operations in Home calendar',
    };

    try {
      const homeCreateResult = await repo.createEvent(
        testEvents.home,
        '/home/'
      );
      testResults.create.home = homeCreateResult;
      console.log(`✅ HOME CREATE: ${homeCreateResult ? 'SUCCESS' : 'FAILED'}`);
    } catch (error) {
      console.log(`❌ HOME CREATE: FAILED - ${error}`);
    }

    // Create in WORK calendar
    testEvents.work = {
      id: `crud-test-work-${timestamp}`,
      title: 'CRUD Test Event - Work',
      date: new Date('2025-08-20T14:00:00.000Z').toISOString(),
      time: '14:00',
      description: 'Testing CRUD operations in Work calendar',
    };

    try {
      const workCreateResult = await repo.createEvent(
        testEvents.work,
        '/work/'
      );
      testResults.create.work = workCreateResult;
      console.log(`✅ WORK CREATE: ${workCreateResult ? 'SUCCESS' : 'FAILED'}`);
    } catch (error) {
      console.log(`❌ WORK CREATE: FAILED - ${error}`);
    }

    // Create in SHARED calendar
    testEvents.shared = {
      id: `crud-test-shared-${timestamp}`,
      title: 'CRUD Test Event - Shared',
      date: new Date('2025-08-20T16:00:00.000Z').toISOString(),
      time: '16:00',
      description: 'Testing CRUD operations in Shared calendar',
    };

    try {
      const sharedCreateResult = await repo.createEvent(
        testEvents.shared,
        '/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/'
      );
      testResults.create.shared = sharedCreateResult;
      console.log(
        `✅ SHARED CREATE: ${sharedCreateResult ? 'SUCCESS' : 'FAILED'}`
      );
    } catch (error) {
      console.log(`❌ SHARED CREATE: FAILED - ${error}`);
    }

    // Create in MEALS calendar
    testEvents.meals = {
      id: `crud-test-meals-${timestamp}`,
      title: 'CRUD Test Event - Meals',
      date: new Date('2025-08-20T18:00:00.000Z').toISOString(),
      time: '18:00',
      description: 'Testing CRUD operations in Meals calendar',
    };

    try {
      const mealsCreateResult = await repo.createEvent(
        testEvents.meals,
        '/1fa1e4097e27af6d41607163c20c088e70cf8e9db9d71b1a62611ec364123914/'
      );
      testResults.create.meals = mealsCreateResult;
      console.log(
        `✅ MEALS CREATE: ${mealsCreateResult ? 'SUCCESS' : 'FAILED'}`
      );
    } catch (error) {
      console.log(`❌ MEALS CREATE: FAILED - ${error}`);
    }

    console.log('\\n⏳ Waiting 3 seconds for CalDAV sync...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // PHASE 2: READ Operations Test
    console.log('\\n📖 PHASE 2: READ OPERATIONS TEST');
    console.log('-'.repeat(30));

    const calendars = [
      { name: 'home', path: '/home/', testEvent: testEvents.home },
      { name: 'work', path: '/work/', testEvent: testEvents.work },
      {
        name: 'shared',
        path: '/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/',
        testEvent: testEvents.shared,
      },
      {
        name: 'meals',
        path: '/1fa1e4097e27af6d41607163c20c088e70cf8e9db9d71b1a62611ec364123914/',
        testEvent: testEvents.meals,
      },
    ];

    for (const cal of calendars) {
      try {
        const xmlData = await repo.fetchCalendarData(cal.path);
        const events = repo.parseCalendarEvents(xmlData);
        const testEventFound = events.find(
          e => e.title === cal.testEvent.title
        );

        testResults.read[cal.name as keyof typeof testResults.read] =
          !!testEventFound;
        console.log(
          `📅 ${cal.name.toUpperCase()} READ: ${testEventFound ? 'SUCCESS' : 'FAILED'} (${events.length} total events)`
        );

        if (testEventFound) {
          console.log(
            `   Found: "${testEventFound.title}" (ID: ${testEventFound.id})`
          );
        }
      } catch (error) {
        console.log(`❌ ${cal.name.toUpperCase()} READ: FAILED - ${error}`);
      }
    }

    // PHASE 3: UPDATE Operations Test
    console.log('\\n✏️ PHASE 3: UPDATE OPERATIONS TEST');
    console.log('-'.repeat(30));

    for (const cal of calendars) {
      if (testResults.create[cal.name as keyof typeof testResults.create]) {
        try {
          const updatedEvent = {
            ...cal.testEvent,
            title: `UPDATED - ${cal.testEvent.title}`,
            description: `This event was successfully updated in ${cal.name} calendar`,
          };

          const updateResult = await repo.updateEvent(updatedEvent, cal.path);
          testResults.update[cal.name as keyof typeof testResults.update] =
            updateResult;
          console.log(
            `✏️ ${cal.name.toUpperCase()} UPDATE: ${updateResult ? 'SUCCESS' : 'FAILED'}`
          );

          // Update our test event reference for deletion
          testEvents[cal.name] = updatedEvent;
        } catch (error) {
          console.log(`❌ ${cal.name.toUpperCase()} UPDATE: FAILED - ${error}`);
        }
      } else {
        console.log(
          `⏭️ ${cal.name.toUpperCase()} UPDATE: SKIPPED (create failed)`
        );
      }
    }

    console.log('\\n⏳ Waiting 3 seconds for CalDAV sync...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify updates worked
    console.log('\\n🔍 VERIFYING UPDATES...');
    for (const cal of calendars) {
      if (testResults.update[cal.name as keyof typeof testResults.update]) {
        try {
          const xmlData = await repo.fetchCalendarData(cal.path);
          const events = repo.parseCalendarEvents(xmlData);
          const updatedEventFound = events.find(e =>
            e.title.startsWith('UPDATED -')
          );

          if (updatedEventFound) {
            console.log(
              `✅ ${cal.name.toUpperCase()} update verified: "${updatedEventFound.title}"`
            );
          } else {
            console.log(`❌ ${cal.name.toUpperCase()} update NOT verified`);
          }
        } catch (error) {
          console.log(
            `❌ ${cal.name.toUpperCase()} update verification failed: ${error}`
          );
        }
      }
    }

    // PHASE 4: DELETE Operations Test
    console.log('\\n🗑️ PHASE 4: DELETE OPERATIONS TEST');
    console.log('-'.repeat(30));

    for (const cal of calendars) {
      if (testResults.create[cal.name as keyof typeof testResults.create]) {
        try {
          // Get events with filenames for proper deletion
          const xmlData = await repo.fetchCalendarData(cal.path);
          const eventsWithFilenames =
            repo.parseCalendarEventsWithFilenames(xmlData);

          // Find our test event
          const testEventToDelete = eventsWithFilenames.find(
            item =>
              item.event.title.includes('UPDATED - CRUD Test Event') ||
              item.event.title.includes('CRUD Test Event')
          );

          if (testEventToDelete) {
            const deleteResult = await repo.deleteEvent(
              testEventToDelete.event.id,
              cal.path,
              testEventToDelete.filename
            );

            testResults.delete[cal.name as keyof typeof testResults.delete] =
              deleteResult;
            console.log(
              `🗑️ ${cal.name.toUpperCase()} DELETE: ${deleteResult ? 'SUCCESS' : 'FAILED'}`
            );
            console.log(
              `   Deleted: "${testEventToDelete.event.title}" (File: ${testEventToDelete.filename})`
            );
          } else {
            console.log(
              `❌ ${cal.name.toUpperCase()} DELETE: FAILED - Test event not found for deletion`
            );
          }
        } catch (error) {
          console.log(`❌ ${cal.name.toUpperCase()} DELETE: FAILED - ${error}`);
        }
      } else {
        console.log(
          `⏭️ ${cal.name.toUpperCase()} DELETE: SKIPPED (create failed)`
        );
      }
    }

    console.log('\\n⏳ Waiting 3 seconds for CalDAV sync...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // FINAL VERIFICATION: Check baseline restored
    console.log('\\n🔍 FINAL VERIFICATION: BASELINE RESTORATION');
    console.log('-'.repeat(30));
    const final = await repo.getAllCalendars();
    final.forEach(cal => {
      console.log(`📅 ${cal.displayName}: ${cal.count} events`);
    });
    const finalTotal = final.reduce((sum, cal) => sum + cal.count, 0);
    console.log(`📊 Total final events: ${finalTotal}`);

    const baselineRestored = finalTotal === baselineTotal;
    console.log(
      `\\n🎯 BASELINE RESTORED: ${baselineRestored ? '✅ YES' : '❌ NO'}`
    );

    // RESULTS SUMMARY
    console.log('\\n📋 CRUD OPERATIONS RESULTS SUMMARY');
    console.log('='.repeat(50));

    const operations = ['create', 'read', 'update', 'delete'] as const;
    const calendars_list = ['home', 'work', 'shared', 'meals'] as const;

    console.log('Calendar  | Create | Read   | Update | Delete');
    console.log('----------|--------|--------|--------|--------');

    calendars_list.forEach(cal => {
      const results = operations.map(op =>
        testResults[op][cal] ? '✅ PASS' : '❌ FAIL'
      );
      console.log(
        `${cal.padEnd(9)} | ${results[0].padEnd(6)} | ${results[1].padEnd(6)} | ${results[2].padEnd(6)} | ${results[3]}`
      );
    });

    // Overall success check
    const allOperationsSuccessful = operations.every(op =>
      calendars_list.every(cal => testResults[op][cal])
    );

    console.log('\\n🎯 OVERALL CRUD TEST RESULT:');
    if (allOperationsSuccessful && baselineRestored) {
      console.log('✅ SUCCESS: All CRUD operations work on all calendars');
      console.log('✅ SUCCESS: Baseline state restored');
      console.log(
        '\\n🎉 CONCLUSION: CRUD operations fully functional across all 4 calendars'
      );
    } else {
      console.log('❌ FAILURE: Some CRUD operations failed');
      if (!baselineRestored) {
        console.log('❌ FAILURE: Baseline state NOT restored');
      }
      console.log(
        '\\n⚠️ CONCLUSION: CRUD operations need debugging before integration'
      );
    }
  } catch (error) {
    console.error('💥 CRITICAL ERROR during CRUD testing:', error);
    console.log('\\n🚨 Test execution failed - manual cleanup may be required');
  }
}

testCRUDAllCalendars();
