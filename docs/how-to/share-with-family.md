# Shared Calendar Guide - Family Calendar Setup

## 📱 Important: We're Using the SHARED Calendar!

Your events are being created in the **SHARED** calendar on iCloud, not your personal Home calendar. This is perfect for a family calendar system where everyone can see and manage events together.

### Calendar Details
- **Calendar Name**: Shared
- **Calendar ID**: `2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E`
- **Location**: Appears in your iPhone Calendar app under "Shared"
- **Sync Status**: ✅ Working and tested

## 👨‍👩‍👧‍👦 Setting Up Family Access

### For the Calendar Owner (You)
1. Open Calendar app on iPhone/Mac
2. Find the "Shared" calendar
3. Tap the (i) info button
4. Select "Add Person..."
5. Enter family member's email (must be their Apple ID email)
6. Choose permissions:
   - **View & Edit**: Family can add/modify events
   - **View Only**: Family can only see events

### For Family Members
1. They'll receive an invitation via email/notification
2. Accept the invitation in their Calendar app
3. The shared calendar will appear in their calendar list
4. They can toggle it on/off for visibility

## 📝 Using Event Metadata for TODOs and Tasks

### Available Metadata Fields for TODO Tracking

Our calendar system supports rich metadata that's perfect for turning events into actionable tasks:

```javascript
{
  // Basic Event Info
  "title": "Buy groceries",          // The TODO item
  "date": "2025-08-17",              // Due date
  "time": "14:00",                   // Due time (optional)
  
  // TODO-Specific Fields
  "description": "Milk, bread, eggs, chips for Saturday", // Task details
  "location": "Whole Foods",         // Where to complete task
  "priority": 1-9,                   // 1=highest, 9=lowest priority
  "status": "CONFIRMED",              // CONFIRMED, TENTATIVE, CANCELLED
  "categories": ["shopping", "urgent"], // Tags for organizing TODOs
  
  // Assignment & Collaboration
  "organizer": "dad@family.com",     // Who created the task
  "attendees": ["mom@family.com"],   // Who's assigned to help
  
  // Advanced TODO Features
  "url": "https://shared-list.com",  // Link to shopping list, docs, etc.
  "rrule": "FREQ=WEEKLY",            // Recurring tasks
  "duration": "PT1H30M",              // Estimated time to complete
  "sequence": 0,                      // Version/update counter
  
  // Progress Tracking (via description field)
  "description": "TODO: [x] Milk [x] Bread [ ] Eggs\nNotes: Get organic eggs"
}
```

### TODO Categories System

Use the `categories` field to organize different types of tasks:

- **`["todo", "urgent"]`** - High priority tasks
- **`["todo", "shopping"]`** - Shopping lists
- **`["todo", "chores"]`** - House chores
- **`["todo", "homework"]`** - Kids' homework
- **`["todo", "bills"]`** - Bill payments
- **`["todo", "recurring"]`** - Repeated tasks

### Status Tracking

Use the `status` field to track TODO completion:
- **`CONFIRMED`** - Active TODO
- **`TENTATIVE`** - Maybe/planning stage
- **`CANCELLED`** - Completed or cancelled

### Priority Levels

Use the `priority` field (1-9):
- **1-3**: High priority (urgent)
- **4-6**: Medium priority (this week)
- **7-9**: Low priority (someday)

## 🔄 Creating TODOs via API

### Create a TODO Event

```bash
curl -X POST http://localhost:3001/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "TODO: Grocery Shopping",
    "date": "2025-08-17T14:00:00.000Z",
    "time": "14:00",
    "description": "[ ] Milk\n[ ] Bread\n[ ] Eggs\n[ ] Chips for Saturday",
    "location": "Whole Foods",
    "categories": ["todo", "shopping"],
    "priority": 3,
    "status": "CONFIRMED"
  }'
```

### Create a Recurring Chore

```bash
curl -X POST http://localhost:3001/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "TODO: Take out trash",
    "date": "2025-08-17T20:00:00.000Z",
    "time": "20:00",
    "description": "Weekly trash collection",
    "categories": ["todo", "chores", "recurring"],
    "rrule": "FREQ=WEEKLY;BYDAY=SU",
    "priority": 2,
    "status": "CONFIRMED"
  }'
```

### Create an Assigned Task

```bash
curl -X POST http://localhost:3001/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "TODO: Science Project",
    "date": "2025-08-20T15:00:00.000Z",
    "time": "15:00",
    "description": "Build volcano model for science class",
    "categories": ["todo", "homework"],
    "organizer": "mom@family.com",
    "attendees": ["kid@family.com", "dad@family.com"],
    "priority": 1,
    "status": "CONFIRMED",
    "url": "https://classroom.google.com/assignment/123"
  }'
```

## 🎨 Visual TODO System in Calendar

### Color Coding (future enhancement)
- Red events: High priority TODOs (priority 1-3)
- Yellow events: Medium priority (priority 4-6)
- Green events: Low priority (priority 7-9)
- Strikethrough: Completed (status = CANCELLED)

### TODO View Filters (future enhancement)
- Show only events with category "todo"
- Group by priority
- Hide completed tasks
- Show assigned tasks only

## 📊 TODO Analytics (via SQLite)

Query your TODO patterns:

```sql
-- Count TODOs by category
SELECT categories, COUNT(*) as count 
FROM events 
WHERE categories LIKE '%todo%' 
GROUP BY categories;

-- Find overdue TODOs
SELECT title, date, priority 
FROM events 
WHERE categories LIKE '%todo%' 
  AND date < date('now') 
  AND status = 'CONFIRMED';

-- See recurring tasks
SELECT title, rrule 
FROM events 
WHERE rrule IS NOT NULL 
  AND categories LIKE '%todo%';
```

## 🚀 Advanced TODO Features

### 1. Checkbox Lists in Description
```
TODO List:
☐ First item
☑ Completed item
☐ Third item
```

### 2. Due Date vs Event Date
- Use `date` + `time` for when to work on it
- Use `dtend` for actual deadline
- Example: Study session at 2pm, exam deadline at 5pm

### 3. Location-Based Reminders
- Set `location` to trigger "when I'm here" reminders
- Great for errands: "TODO: Return package" with location "Post Office"

### 4. Collaborative TODOs
- Use `attendees` to assign family members
- Everyone sees the same TODO in their calendar
- Updates sync across all devices

### 5. Project Management
- Use `sequence` number to track versions
- Use `url` to link to project documents
- Use hierarchical categories: `["todo", "project", "home-renovation"]`

## 🔐 Privacy & Permissions

### What Family Members Can See
- All event details (title, description, time, location)
- All metadata (categories, priority, status)
- Who created/modified events

### What They Can Do (with Edit permission)
- Add new events/TODOs
- Modify existing events
- Delete events
- Change any metadata

### Best Practices
1. Use clear, descriptive titles
2. Keep sensitive info out of shared events
3. Use categories consistently
4. Update status when completing TODOs
5. Clean up old completed TODOs monthly

## 🐛 Troubleshooting

### Events Not Appearing on iPhone
1. Check Calendar app → Calendars → ensure "Shared" is checked
2. Pull down to refresh in Calendar app
3. Check Settings → Calendar → Sync → All Events

### Can't Edit Events
- Verify you have Edit permissions (not just View)
- Check internet connection for sync
- Try force-closing and reopening Calendar app

### Sync Delays
- Apple Calendar typically syncs within 1-5 minutes
- Force sync: Settings → Calendar → Accounts → Fetch New Data → Push

## 💡 Pro Tips

1. **Morning Review**: Create a "TODO: Daily Review" recurring event at 8am
2. **Shopping Lists**: One event per store with items in description
3. **Bill Reminders**: Use recurring events with "TODO: Pay [bill]"
4. **Kids' Chores**: Assign via attendees, they see it on their devices
5. **Meal Planning**: Week's dinners as TODOs with recipes in URL field

---

Remember: This shared calendar is your family's central command center. Every event is visible to everyone, making it perfect for coordinating schedules, assigning tasks, and keeping the household running smoothly!