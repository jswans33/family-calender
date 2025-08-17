import { CalDAVMultiCalendarRepository } from './server-src/repositories/CalDAVMultiCalendarRepository.js';
import { CalDAVConfig } from './server-src/config/CalDAVConfig.js';
import fs from 'fs';
import path from 'path';

async function verifyCRUDOperations() {
  console.log('🔍 CRUD OPERATIONS VERIFICATION SCRIPT');
  console.log('=====================================');

  // Create log file
  const timestamp = Date.now();
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logFile = path.join(logDir, `crud-verification-${timestamp}.log`);

  const logToFile = (message: string) => {
    fs.appendFileSync(logFile, message + '\n');
  };

  const logBoth = (message: string) => {
    console.log(message);
    logToFile(message);
  };

  logBoth('🔍 CRUD OPERATIONS VERIFICATION SCRIPT');
  logBoth('=====================================');
  logBoth(`Started: ${new Date().toISOString()}`);
  logBoth(`Log file: ${logFile}`);

  const repo = new CalDAVMultiCalendarRepository(
    CalDAVConfig.getFallbackCredentials()
  );
  const testTimestamp = Date.now();
  const testResults: any[] = [];

  // Log function
  const log = (
    operation: string,
    calendar: string,
    eventId: string,
    result: boolean,
    details: string
  ) => {
    const status = result ? '✅ PASS' : '❌ FAIL';
    const entry = {
      timestamp: new Date().toISOString(),
      operation,
      calendar,
      eventId,
      result: status,
      details,
      verificationCommand: getVerificationCommand(operation, calendar, eventId),
    };
    testResults.push(entry);
    const message = `${status} ${operation.padEnd(6)} | ${calendar.padEnd(6)} | ${eventId.substring(0, 20)}... | ${details}`;
    logBoth(message);
  };

  const getVerificationCommand = (op: string, cal: string, id: string) => {
    const calPaths = {
      home: '/home/',
      work: '/work/',
      shared: '/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/',
      meals:
        '/1fa1e4097e27af6d41607163c20c088e70cf8e9db9d71b1a62611ec364123914/',
    };
    const path = calPaths[cal as keyof typeof calPaths];

    switch (op) {
      case 'CREATE':
      case 'READ':
        return `curl -s -X REPORT -H "Authorization: Basic $(echo -n 'jswans33@gmail.com:qrdq-tahw-xski-ogbf' | base64)" https://p36-caldav.icloud.com/1110188709/calendars${path} | grep -i "${id.substring(0, 15)}"`;
      case 'DELETE':
        return `curl -s -X REPORT -H "Authorization: Basic $(echo -n 'jswans33@gmail.com:qrdq-tahw-xski-ogbf' | base64)" https://p36-caldav.icloud.com/1110188709/calendars${path} | grep -i "${id.substring(0, 15)}" | wc -l`;
      default:
        return `./get_all_caldav_events.sh | grep -i "${id.substring(0, 15)}"`;
    }
  };

  // Test events for each calendar
  const testEvents = {
    home: {
      id: `verify-home-${testTimestamp}`,
      title: `Verify Home - ${testTimestamp}`,
      date: new Date('2025-08-21T10:00:00.000Z').toISOString(),
      time: '10:00',
      description: 'Verification test for Home calendar',
    },
    work: {
      id: `verify-work-${testTimestamp}`,
      title: `Verify Work - ${testTimestamp}`,
      date: new Date('2025-08-21T14:00:00.000Z').toISOString(),
      time: '14:00',
      description: 'Verification test for Work calendar',
    },
    shared: {
      id: `verify-shared-${testTimestamp}`,
      title: `Verify Shared - ${testTimestamp}`,
      date: new Date('2025-08-21T16:00:00.000Z').toISOString(),
      time: '16:00',
      description: 'Verification test for Shared calendar',
    },
    meals: {
      id: `verify-meals-${timestamp}`,
      title: `Verify Meals - ${timestamp}`,
      date: new Date('2025-08-21T18:00:00.000Z').toISOString(),
      time: '18:00',
      description: 'Verification test for Meals calendar',
    },
  };

  const calendars = [
    { name: 'home', path: '/home/', event: testEvents.home },
    { name: 'work', path: '/work/', event: testEvents.work },
    {
      name: 'shared',
      path: '/2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E/',
      event: testEvents.shared,
    },
    {
      name: 'meals',
      path: '/1fa1e4097e27af6d41607163c20c088e70cf8e9db9d71b1a62611ec364123914/',
      event: testEvents.meals,
    },
  ];

  logBoth('\\nOP     | CAL    | EVENT ID             | DETAILS');
  logBoth(
    '-------|--------|----------------------|--------------------------------'
  );

  try {
    // PHASE 1: CREATE OPERATIONS
    logBoth('\\n📝 TESTING CREATE OPERATIONS');
    for (const cal of calendars) {
      try {
        const createResult = await repo.createEvent(cal.event, cal.path);
        log(
          'CREATE',
          cal.name,
          cal.event.id,
          createResult,
          `Event created in ${cal.name} calendar`
        );
      } catch (error) {
        log('CREATE', cal.name, cal.event.id, false, `Error: ${error}`);
      }
    }

    // Wait for CalDAV sync
    await new Promise(resolve => setTimeout(resolve, 2000));

    // PHASE 2: READ OPERATIONS
    logBoth('\\n📖 TESTING READ OPERATIONS');
    for (const cal of calendars) {
      try {
        const xmlData = await repo.fetchCalendarData(cal.path);
        const events = repo.parseCalendarEvents(xmlData);
        const found = events.find(e => e.id === cal.event.id);
        log(
          'READ',
          cal.name,
          cal.event.id,
          !!found,
          found ? `Found: "${found.title}"` : 'Event not found'
        );
      } catch (error) {
        log('READ', cal.name, cal.event.id, false, `Error: ${error}`);
      }
    }

    // PHASE 3: UPDATE OPERATIONS
    logBoth('\\n✏️ TESTING UPDATE OPERATIONS');
    for (const cal of calendars) {
      try {
        const updatedEvent = {
          ...cal.event,
          title: `UPDATED ${cal.event.title}`,
          description: `Updated description for ${cal.name}`,
        };
        const updateResult = await repo.updateEvent(updatedEvent, cal.path);
        log(
          'UPDATE',
          cal.name,
          cal.event.id,
          updateResult,
          `Title updated to include "UPDATED"`
        );

        // Update reference for deletion
        cal.event.title = updatedEvent.title;
      } catch (error) {
        log('UPDATE', cal.name, cal.event.id, false, `Error: ${error}`);
      }
    }

    // Wait for CalDAV sync
    await new Promise(resolve => setTimeout(resolve, 2000));

    // PHASE 4: DELETE OPERATIONS
    logBoth('\\n🗑️ TESTING DELETE OPERATIONS');
    for (const cal of calendars) {
      try {
        // Get filename for proper deletion
        const xmlData = await repo.fetchCalendarData(cal.path);
        const eventsWithFiles = repo.parseCalendarEventsWithFilenames(xmlData);
        const eventToDelete = eventsWithFiles.find(
          item => item.event.id === cal.event.id
        );

        if (eventToDelete) {
          const deleteResult = await repo.deleteEvent(
            cal.event.id,
            cal.path,
            eventToDelete.filename
          );
          log(
            'DELETE',
            cal.name,
            cal.event.id,
            deleteResult,
            `File: ${eventToDelete.filename}`
          );
        } else {
          log(
            'DELETE',
            cal.name,
            cal.event.id,
            false,
            'Event not found for deletion'
          );
        }
      } catch (error) {
        log('DELETE', cal.name, cal.event.id, false, `Error: ${error}`);
      }
    }

    // Wait for CalDAV sync
    await new Promise(resolve => setTimeout(resolve, 2000));

    // FINAL VERIFICATION
    logBoth('\\n🔍 FINAL CLEANUP VERIFICATION');
    for (const cal of calendars) {
      try {
        const xmlData = await repo.fetchCalendarData(cal.path);
        const events = repo.parseCalendarEvents(xmlData);
        const stillExists = events.find(e => e.id === cal.event.id);
        log(
          'VERIFY',
          cal.name,
          cal.event.id,
          !stillExists,
          stillExists ? 'Event still exists!' : 'Event properly cleaned up'
        );
      } catch (error) {
        log('VERIFY', cal.name, cal.event.id, false, `Error: ${error}`);
      }
    }
  } catch (error) {
    const errorMsg = '\\n💥 CRITICAL ERROR: ' + error;
    console.error(errorMsg);
    logToFile(errorMsg);
  }

  // SUMMARY REPORT
  logBoth('\\n📊 VERIFICATION SUMMARY');
  logBoth('========================');

  const operations = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'VERIFY'];
  const calendarNames = ['home', 'work', 'shared', 'meals'];

  logBoth('Calendar | Create | Read   | Update | Delete | Verify | Overall');
  logBoth('---------|--------|--------|--------|--------|--------|--------');

  calendarNames.forEach(calName => {
    const results = operations.map(op => {
      const result = testResults.find(
        r => r.operation === op && r.calendar === calName
      );
      return result ? (result.result === '✅ PASS' ? '✅' : '❌') : '⚪';
    });
    const overall = results.every(r => r === '✅') ? '✅ PASS' : '❌ FAIL';
    logBoth(
      `${calName.padEnd(8)} | ${results[0].padEnd(6)} | ${results[1].padEnd(6)} | ${results[2].padEnd(6)} | ${results[3].padEnd(6)} | ${results[4].padEnd(6)} | ${overall}`
    );
  });

  // INDEPENDENT VERIFICATION COMMANDS
  logBoth('\\n🔧 INDEPENDENT VERIFICATION COMMANDS');
  logBoth('====================================');
  logBoth('1. Check baseline state:');
  logBoth('   ./get_all_caldav_events.sh | grep "Events found:"');
  logBoth('');
  logBoth('2. Verify no test events remain:');
  logBoth(
    `   ./get_all_caldav_events.sh | grep -i "verify.*${timestamp.toString().substring(8)}" | wc -l`
  );
  logBoth('   (Should return: 0)');
  logBoth('');
  logBoth('3. Run full CRUD test again:');
  logBoth('   npx tsx verify-crud-operations.ts');
  logBoth('');
  logBoth('4. Manual CalDAV verification (example for Home):');
  logBoth('   curl -s -X REPORT \\\\');
  logBoth(
    '     -H "Authorization: Basic $(echo -n \'jswans33@gmail.com:qrdq-tahw-xski-ogbf\' | base64)" \\\\'
  );
  logBoth(
    '     https://p36-caldav.icloud.com/1110188709/calendars/home/ | grep SUMMARY'
  );

  // DETAILED TEST LOG
  logBoth('\\n📋 DETAILED TEST LOG');
  logBoth('====================');
  testResults.forEach((result, index) => {
    logBoth(
      `${(index + 1).toString().padStart(2, '0')}. ${result.timestamp} | ${result.result} | ${result.operation} ${result.calendar} | ${result.details}`
    );
    logBoth(`    Verify: ${result.verificationCommand}`);
    logBoth('');
  });

  const allPassed = testResults.every(r => r.result === '✅ PASS');
  logBoth('\\n🎯 FINAL RESULT:');
  logBoth(
    allPassed
      ? '✅ ALL CRUD OPERATIONS VERIFIED SUCCESSFUL'
      : '❌ SOME OPERATIONS FAILED'
  );
  logBoth(
    `📊 Success Rate: ${testResults.filter(r => r.result === '✅ PASS').length}/${testResults.length} operations`
  );
  logBoth(`\\n📁 Full log saved to: ${logFile}`);
}

verifyCRUDOperations();
