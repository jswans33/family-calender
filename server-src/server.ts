import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { CalendarController } from './controllers/CalendarController.js';
import { DatabaseCalendarService } from './services/DatabaseCalendarService.js';
import { CalDAVRepository } from './repositories/CalDAVRepository.js';
import { CalDAVMultiCalendarRepository } from './repositories/CalDAVMultiCalendarRepository.js';
import { SQLiteRepository } from './repositories/SQLiteRepository.js';
import { CalDAVConfig } from './config/CalDAVConfig.js';
import { DatabaseConfigProvider } from './config/DatabaseConfig.js';
import { VacationService } from './services/VacationService.js';

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
const credentials = CalDAVConfig.getFallbackCredentials();
const calDAVRepository = new CalDAVRepository(credentials);
const multiCalendarRepository = new CalDAVMultiCalendarRepository(credentials);
const sqliteRepository = new SQLiteRepository(dbConfig.path);
const calendarService = new DatabaseCalendarService(
  calDAVRepository,
  multiCalendarRepository,
  sqliteRepository,
  dbConfig.syncIntervalMinutes
);
const vacationService = new VacationService(sqliteRepository);
const calendarController = new CalendarController(calendarService);

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
// Enhanced event deletion with vacation processing (modular)
app.delete('/events/:id', async (req, res) => {
  try {
    // Get the event before deletion for vacation processing
    const events = await calendarService.getEventsWithMetadata();
    const eventToDelete = events.find(e => e.id === req.params.id);
    
    // Delete the event through the controller
    await calendarController.deleteEvent(req, res);
    
    // If deletion was successful and it was a vacation event, restore vacation hours
    if (res.statusCode === 200 && eventToDelete?.isVacation) {
      try {
        await vacationService.processVacationEventDeletion(eventToDelete);
      } catch (vacationError) {
        console.error('Vacation restoration failed (event still deleted):', vacationError);
        // Don't fail the response since the event was deleted successfully
      }
    }
  } catch (error) {
    // Fallback to controller if our enhancement fails
    await calendarController.deleteEvent(req, res);
  }
});
// Enhanced event creation with vacation processing (modular)
app.post('/events', async (req, res) => {
  try {
    // Validate vacation event if needed
    if (req.body.isVacation) {
      const validation = vacationService.validateVacationEvent(req.body);
      if (!validation.isValid) {
        res.status(400).json({
          error: 'Invalid vacation event',
          errors: validation.errors
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
        console.error('Vacation processing failed (event still created):', vacationError);
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
    res.json(calendars);
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

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  sqliteRepository.close();
  process.exit(0);
});

// Start the Express server
app.listen(port, () => {
  console.log(
    `TypeScript CalDAV server with SQLite cache listening at http://localhost:${port}`
  );
});
