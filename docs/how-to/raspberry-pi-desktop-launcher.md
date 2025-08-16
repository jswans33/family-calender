# Raspberry Pi Desktop Launcher

## Desktop Icons

Two desktop icons are now available on your Raspberry Pi desktop:

1. **Swanson Light Calendar** - Starts the full application
2. **Stop Calendar** - Stops the application

## What the Start Script Does

When you double-click "Swanson Light Calendar":

1. **✅ Checks Node.js and npm** are installed
2. **📥 Pulls latest changes** from git repository
3. **📦 Installs dependencies** if missing
4. **🏗️ Builds frontend and backend** for production
5. **🛑 Kills any existing processes** to avoid conflicts
6. **🚀 Starts backend server** (Node.js/Express on port 3001)
7. **🚀 Starts frontend server** (production build on port 3000)
8. **🌐 Opens Chromium browser** automatically
9. **📋 Shows live logs** in the terminal window

## Access URLs

Once started, access the calendar at:
- **Local**: http://localhost:3000
- **Network**: http://192.168.68.54:3000 (from other devices)
- **Backend API**: http://localhost:3001 or http://192.168.68.54:3001

## Manual Commands

You can also run these commands manually in terminal:

```bash
# Start calendar
~/swanson-light/start-calendar.sh

# Stop calendar  
~/swanson-light/stop-calendar.sh
```

## Logs

Application logs are saved in the project directory:
- `~/swanson-light/frontend.log` - Frontend server logs
- `~/swanson-light/backend.log` - Backend server logs

## Troubleshooting

**If the application won't start:**
1. Click "Stop Calendar" first
2. Wait 5 seconds
3. Click "Swanson Light Calendar" again

**If browser doesn't open automatically:**
- Manually navigate to http://localhost:3000

**To view logs:**
- The terminal window shows live logs when running
- Or check the log files manually: `tail -f ~/swanson-light/frontend.log`