#!/usr/bin/env npx tsx
import { Command } from 'commander';

const program = new Command();
const API_BASE = 'http://localhost:3001';
const CALENDARS = ['home', 'work', 'shared', 'meals'];

program
  .name('sync-check')
  .description('Check if API database and CalDAV are in sync')
  .version('1.0.0');

program
  .command('verify')
  .description('Compare API vs CalDAV event counts')
  .action(async () => {
    console.log('🔍 SYNC VERIFICATION');
    console.log('='.repeat(50));

    let totalDiscrepancies = 0;

    for (const calendar of CALENDARS) {
      try {
        // Get API count
        const apiResponse = await fetch(
          `${API_BASE}/events?calendar=${calendar}`
        );
        const apiEvents = await apiResponse.json();
        const apiCount = apiEvents.length;

        // Get CalDAV count (using calendar CLI)
        const { execSync } = await import('child_process');
        const caldavOutput = execSync(
          `npx tsx scripts/calendar-cli.ts read -c ${calendar} | grep "Found.*events in ${calendar}"`,
          { encoding: 'utf-8' }
        );
        const caldavMatch = caldavOutput.match(/Found (\d+) events/);
        const caldavCount = caldavMatch ? parseInt(caldavMatch[1]) : 0;

        const diff = caldavCount - apiCount;
        const status = diff === 0 ? '✅' : '❌';

        console.log(
          `${status} ${calendar.toUpperCase()}: API=${apiCount}, CalDAV=${caldavCount}, diff=${diff > 0 ? '+' : ''}${diff}`
        );

        if (diff !== 0) {
          totalDiscrepancies += Math.abs(diff);
        }
      } catch (error) {
        console.log(`❌ ${calendar.toUpperCase()}: ERROR - ${error}`);
        totalDiscrepancies++;
      }
    }

    console.log('='.repeat(50));
    if (totalDiscrepancies === 0) {
      console.log('✅ ALL CALENDARS IN SYNC');
    } else {
      console.log(`❌ ${totalDiscrepancies} DISCREPANCIES FOUND`);
      console.log('Run sync-check cleanup to fix orphaned CalDAV events');
    }
  });

program
  .command('cleanup')
  .description('Remove orphaned CalDAV events not in database')
  .action(async () => {
    console.log('🧹 CLEANUP ORPHANED CALDAV EVENTS');
    console.log('='.repeat(50));

    console.log(
      'WARNING: This will delete CalDAV events not found in API database'
    );
    console.log('Make sure to backup your calendar first!');
    console.log('');
    console.log('This is a manual process:');
    console.log('1. Run sync-check verify to see discrepancies');
    console.log('2. Export CalDAV data: npx tsx scripts/calendar-cli.ts read');
    console.log('3. Compare with API data: curl http://localhost:3001/events');
    console.log('4. Manually delete specific .ics files from CalDAV');
  });

program.parse();
