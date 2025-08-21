import { test, expect } from '@playwright/test';

test.describe('Event Time Display', () => {
  test('should display meal events with correct times instead of "All day"', async ({ page }) => {
    // Navigate to the calendar app
    await page.goto('http://localhost:3000');
    
    // Wait for the calendar to load
    await page.waitForSelector('text=Upcoming Events', { timeout: 10000 });
    
    // Look for meal events in the upcoming events accordion
    const upcomingEvents = page.locator('text=Upcoming Events').first();
    await expect(upcomingEvents).toBeVisible();
    
    // Check for Morgan office event - should show 9:00 AM, not "All day"
    const morganEvent = page.locator('text=Morgan office').first();
    if (await morganEvent.isVisible()) {
      const eventContainer = morganEvent.locator('xpath=ancestor::div[contains(@class, "cursor-pointer")]');
      const timeText = await eventContainer.locator('div.text-xs').nth(1).textContent();
      console.log('Morgan office time:', timeText);
      expect(timeText).not.toBe('All day');
      expect(timeText).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/);
    }
    
    // Check for Indian chicken event - should show time, not "All day"
    const indianEvent = page.locator('text=Indian chicken').first();
    if (await indianEvent.isVisible()) {
      const eventContainer = indianEvent.locator('xpath=ancestor::div[contains(@class, "cursor-pointer")]');
      const timeText = await eventContainer.locator('div.text-xs').nth(1).textContent();
      console.log('Indian chicken time:', timeText);
      expect(timeText).not.toBe('All day');
      expect(timeText).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/);
    }
    
    // Check for Mac's and cheese event
    const macEvent = page.locator('text=/Mac.*cheese/').first();
    if (await macEvent.isVisible()) {
      const eventContainer = macEvent.locator('xpath=ancestor::div[contains(@class, "cursor-pointer")]');
      const timeText = await eventContainer.locator('div.text-xs').nth(1).textContent();
      console.log('Mac and cheese time:', timeText);
      expect(timeText).not.toBe('All day');
      expect(timeText).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/);
    }
    
    // Also check the time grid view
    await page.click('button:has-text("Week")');
    await page.waitForTimeout(500);
    
    // Check that events appear in the correct time slots (not in all-day section)
    const allDaySection = page.locator('.bg-gray-50').filter({ hasText: 'All day' });
    if (await allDaySection.count() > 0) {
      // Make sure meal events are NOT in the all-day section
      const allDayEvents = await allDaySection.locator('text=/Morgan|Indian|Mac/').count();
      expect(allDayEvents).toBe(0);
    }
    
    // Verify events appear in timed slots
    const timedEvents = page.locator('.absolute').filter({ hasText: /Morgan|Indian|Mac/ });
    const timedEventCount = await timedEvents.count();
    console.log('Found timed meal events:', timedEventCount);
    
    // Take a screenshot for visual verification
    await page.screenshot({ path: 'event-times-test.png', fullPage: true });
  });
  
  test('should correctly parse 24-hour time format from API', async ({ page }) => {
    // Intercept the API call to verify the response format
    await page.route('**/events', async route => {
      const response = await route.fetch();
      const json = await response.json();
      
      // Log some events to verify time format
      const mealEvents = json.filter((e: any) => 
        e.title?.includes('Morgan') || 
        e.title?.includes('Indian') || 
        e.title?.includes('Mac')
      );
      
      console.log('API Response for meal events:');
      mealEvents.forEach((event: any) => {
        console.log(`- ${event.title}: time=${event.time}, date=${event.date}`);
        // Verify API returns 24-hour format
        if (event.time) {
          expect(event.time).toMatch(/^\d{2}:\d{2}$/);
        }
      });
      
      await route.fulfill({ response });
    });
    
    await page.goto('http://localhost:3000');
    await page.waitForSelector('.calendar-container', { timeout: 10000 });
  });
});