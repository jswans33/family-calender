import express from 'express';
import cors from 'cors';
import { CalendarController } from './controllers/CalendarController.js';
import { CalendarService } from './services/CalendarService.js';
import { CalDAVRepository } from './repositories/CalDAVRepository.js';
import { CalDAVConfig } from './config/CalDAVConfig.js';

const app = express();
const port = 3001;

app.use(cors());

// Initialize dependencies following proper layered architecture
const credentials = CalDAVConfig.getFallbackCredentials();
const calDAVRepository = new CalDAVRepository(credentials);
const calendarService = new CalendarService(calDAVRepository);
const calendarController = new CalendarController(calendarService);

// Routes
app.get('/events', (req, res) => calendarController.getEvents(req, res));
app.get('/events/today', (req, res) => calendarController.getTodaysEvents(req, res));
app.get('/events/week', (req, res) => calendarController.getThisWeeksEvents(req, res));
app.get('/events/month', (req, res) => calendarController.getThisMonthsEvents(req, res));

// Start the Express server
app.listen(port, () => {
  console.log(`TypeScript CalDAV server listening at http://localhost:${port}`);
});