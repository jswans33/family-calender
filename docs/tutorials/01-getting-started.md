# Tutorial: Getting Started with Swanson Light Calendar

**Time to complete:** 15 minutes  
**What you'll learn:** How to set up and run your first family calendar system

## What You'll Build

By the end of this tutorial, you will have:

- A running calendar server connected to Apple iCloud
- Your first event created and synced
- The calendar visible on your iPhone

## Prerequisites

Before starting, you need:

- Node.js 18+ installed
- An Apple ID with 2-factor authentication enabled
- An iPhone or Mac with Calendar app

## Step 1: Clone and Install

Open your terminal and run:

```bash
git clone https://github.com/yourusername/swanson-light.git
cd swanson-light
npm install
```

You should see packages installing. Wait for the installation to complete.

## Step 2: Get Your Apple App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in with your Apple ID
3. Click "Sign-In and Security"
4. Click "App-Specific Passwords"
5. Click the "+" button
6. Name it "Calendar Sync"
7. Copy the password shown (format: xxxx-xxxx-xxxx-xxxx)

**Important:** Save this password - you'll need it in the next step!

## Step 3: Configure Your Calendar

Create a `.env` file in the project root:

```bash
touch .env
```

Open it and add:

```env
CALDAV_USERNAME=your-apple-id@icloud.com
CALDAV_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

Replace with your actual Apple ID and the app-specific password from Step 2.

## Step 4: Start the Server

Run the development server:

```bash
npm run start:server:dev
```

You should see:

```
TypeScript CalDAV server with SQLite cache listening at http://localhost:3001
Connected to SQLite database at: ./data/calendar.db
Events table initialized successfully
```

✅ **Success!** Your server is running!

## Step 5: Create Your First Event

In a new terminal window (keep the server running), create an event:

```bash
curl -X POST http://localhost:3001/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Event",
    "date": "2025-08-20T14:00:00.000Z",
    "time": "14:00",
    "description": "Testing the calendar"
  }'
```

You should see:

```json
{
  "success": true,
  "message": "Event created successfully",
  "id": "local-xxxxxxxxx"
}
```

## Step 6: Verify on Your iPhone

1. Open the Calendar app on your iPhone
2. Look for the "Shared" calendar (it may be under "Other")
3. You should see "My First Event" on the date you specified

**Note:** It may take 1-2 minutes for the event to sync to your phone.

## Step 7: View All Events

Check that your event is in the system:

```bash
curl http://localhost:3001/events | jq '.[0]'
```

You'll see your event with all its details!

## What You've Accomplished

Congratulations! You have:

- ✅ Set up a calendar server
- ✅ Connected it to Apple iCloud
- ✅ Created your first event
- ✅ Synced it to your iPhone
- ✅ Retrieved events via API

## Next Steps

Now that you have a working calendar:

- [Tutorial: Create Your First TODO Event](./02-first-todo.md)
- [Tutorial: Set Up Family Sharing](./03-family-sharing.md)
- [How-To: Create Recurring Events](../how-to/create-recurring-events.md)

## Troubleshooting

**Server won't start?**

- Check that port 3001 is free: `lsof -i :3001`
- Verify Node.js version: `node --version` (should be 18+)

**401 Unauthorized error?**

- Double-check your Apple ID email
- Regenerate app-specific password
- Make sure you're using the app password, not your Apple ID password

**Events not appearing on iPhone?**

- Pull down to refresh in Calendar app
- Check that "Shared" calendar is enabled
- Wait 2-3 minutes for sync

---

📚 This is a **tutorial** - designed to take you from zero to a working system through hands-on learning.
