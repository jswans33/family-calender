import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { CalendarController } from './controllers/CalendarController.js';
import { CalendarFacadeService } from './services/CalendarFacadeService.js';
import { CalDAVRepository } from './repositories/CalDAVRepository.js';
import { CalDAVMultiCalendarRepository } from './repositories/CalDAVMultiCalendarRepository.js';
import { SQLiteCompositeRepository } from './repositories/SQLiteCompositeRepository.js';
import { CalDAVConfig } from './config/CalDAVConfig.js';
import { DatabaseConfigProvider } from './config/DatabaseConfig.js';
import { VacationService } from './services/VacationService.js';
import { VacationDataService } from './services/VacationDataService.js';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: false }));

// Initialize dependencies with database layer
const dbConfig = DatabaseConfigProvider.getConfig();

// Ensure database directory exists
const dbDir = path.dirname(dbConfig.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize repositories and service with SQLite caching
const credentials = CalDAVConfig.getCredentials();
const calDAVRepository = new CalDAVRepository(credentials);
const multiCalendarRepository = new CalDAVMultiCalendarRepository(credentials);
const sqliteRepository = new SQLiteCompositeRepository(dbConfig.path);
const calendarService = new CalendarFacadeService(
  calDAVRepository,
  multiCalendarRepository,
  sqliteRepository,
  dbConfig.syncIntervalMinutes
);
const vacationDataService = new VacationDataService(sqliteRepository);
const vacationService = new VacationService(vacationDataService);
const calendarController = new CalendarController(
  calendarService,
  vacationService
);

// Routes
app.get('/events', (req, res) => calendarController.getEvents(req, res));
app.get('/events/today', (req, res) =>
  calendarController.getTodaysEvents(req, res)
);
app.get('/events/week', (req, res) =>
  calendarController.getThisWeeksEvents(req, res)
);
app.get('/events/month', (req, res) =>
  calendarController.getThisMonthsEvents(req, res)
);
app.put('/events/:id', (req, res) => calendarController.updateEvent(req, res));
app.delete('/events/:id', (req, res) =>
  calendarController.deleteEvent(req, res)
);
// CODE_SMELL: Rule #1 One Thing Per File - Business logic in server.ts
// Fix: Move vacation processing to CalendarController or middleware
// Enhanced event creation with vacation processing (modular)
app.post('/events', async (req, res) => {
  try {
    // Validate vacation event if needed
    if (req.body.isVacation) {
      const validation = vacationService.validateVacationEvent(req.body);
      if (!validation.isValid) {
        res.status(400).json({
          error: 'Invalid vacation event',
          errors: validation.errors,
        });
        return;
      }
    }

    // Create the event through the controller
    await calendarController.createEvent(req, res);

    // If event creation was successful and it's a vacation event, process vacation hours
    if (res.statusCode === 201 && req.body.isVacation) {
      try {
        await vacationService.processVacationEventCreation(req.body);
      } catch (vacationError) {
        console.error(
          'Vacation processing failed (event still created):',
          vacationError
        );
        // Don't fail the response since the event was created successfully
      }
    }
  } catch (error) {
    // Fallback to controller if our enhancement fails
    await calendarController.createEvent(req, res);
  }
});

// Calendar discovery endpoint
app.get('/calendars', async (req, res) => {
  try {
    const calendars = await calendarService.getCalendars();
    // Add displayName to each calendar
    const calendarsWithDisplayName = calendars.map(cal => ({
      name: cal.name,
      displayName: cal.name.charAt(0).toUpperCase() + cal.name.slice(1), // Capitalize first letter
      count: cal.count,
    }));
    res.json(calendarsWithDisplayName);
  } catch (error) {
    console.error('Error getting calendars:', error);
    res.status(500).json({ error: 'Failed to get calendars' });
  }
});

// Vacation tracking endpoints (modular)
app.get('/vacation-balances', async (req, res) => {
  try {
    const balances = await vacationService.getVacationBalances();
    res.json(balances);
  } catch (error) {
    console.error('Error getting vacation balances:', error);
    res.status(500).json({ error: 'Failed to get vacation balances' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Admin routes for database management
app.post('/admin/sync', async (req, res) => {
  try {
    if (calendarService.forceSync) {
      await calendarService.forceSync();
      res.json({ success: true, message: 'Sync completed' });
    } else {
      res.status(501).json({ error: 'Sync not supported by this service' });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Sync failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update vacation balance endpoint
app.put('/vacation-balance', async (req, res) => {
  try {
    const { userName, balanceHours } = req.body;

    if (!userName || balanceHours === undefined) {
      return res
        .status(400)
        .json({ error: 'userName and balanceHours are required' });
    }

    await vacationDataService.updateVacationBalance(userName, balanceHours);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update vacation balance',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get vacation events endpoint
app.get('/vacation-events', async (_req, res) => {
  try {
    // Use the same method as the main /events endpoint
    const events = await calendarService.getEventsWithMetadata();

    const vacationEvents = events
      .filter(event => {
        return event.isVacation === true && event.calendar_name === 'work';
      })
      .map(event => {
        // Calculate hours based on if it's a work day
        const date = new Date(event.date);
        const dayOfWeek = date.getDay();
        const isWorkDay = dayOfWeek !== 0 && dayOfWeek !== 6;
        const hours = isWorkDay ? 8 : 0;

        return {
          id: event.id,
          title: event.title,
          date: event.date,
          hours: hours,
          user: 'james', // For now, hardcoded. Could be enhanced later
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    res.json(vacationEvents);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch vacation events',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  sqliteRepository.close();
  process.exit(0);
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
