import { CalDAVMultiCalendarRepository } from '../server-src/repositories/CalDAVMultiCalendarRepository.js';
import { CalDAVConfig } from '../server-src/config/CalDAVConfig.js';

async function createMealEvents() {
  console.log('🍽️  CREATING MEAL EVENTS IN MEALS CALENDAR');
  console.log('='.repeat(50));

  const repo = new CalDAVMultiCalendarRepository(
    CalDAVConfig.getFallbackCredentials()
  );

  const mealEvents = [
    {
      id: 'pancake-breakfast-aug18',
      title: 'Pancake Breakfast',
      date: '2025-08-18',
      time: '08:00',
      description: 'Family pancake breakfast',
      dtend: '2025-08-18T09:00:00.000Z',
    },
    {
      id: 'taco-tuesday-aug19',
      title: 'Taco Tuesday Lunch',
      date: '2025-08-19',
      time: '12:30',
      description: 'Weekly taco lunch',
      dtend: '2025-08-19T13:30:00.000Z',
    },
    {
      id: 'pizza-night-aug20',
      title: 'Pizza Night',
      date: '2025-08-20',
      time: '18:30',
      description: 'Family pizza night',
      dtend: '2025-08-20T20:00:00.000Z',
    },
  ];

  try {
    for (const event of mealEvents) {
      console.log(`🍽️  Creating ${event.title}...`);
      const success = await repo.createEventInCalendar(event, 'meals');
      if (success) {
        console.log(`✅ Created ${event.title} in meals calendar`);
      } else {
        console.log(`❌ Failed to create ${event.title}`);
      }
    }

    console.log('\n🎉 Meal events created! Check React interface and iPhone.');
  } catch (error) {
    console.error('❌ Error creating meal events:', error);
  }
}

createMealEvents();
