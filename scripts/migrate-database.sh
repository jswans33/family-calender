#!/bin/bash

# Database Migration Script
# Ensures the database has all required columns

echo "🔄 Running database migrations..."

DB_PATH="./data/calendar.db"

if [ ! -f "$DB_PATH" ]; then
    echo "❌ Database not found at $DB_PATH"
    exit 1
fi

# Check if sqlite3 is available
if ! command -v sqlite3 &> /dev/null; then
    echo "❌ sqlite3 not found! Installing..."
    sudo apt-get update && sudo apt-get install -y sqlite3
fi

# Add missing columns if they don't exist
echo "Checking for missing columns..."

# Check if caldav_filename exists
COLUMN_EXISTS=$(sqlite3 "$DB_PATH" "PRAGMA table_info(events);" | grep "caldav_filename" | wc -l)
if [ "$COLUMN_EXISTS" -eq 0 ]; then
    echo "Adding caldav_filename column..."
    sqlite3 "$DB_PATH" "ALTER TABLE events ADD COLUMN caldav_filename TEXT;"
fi

# Check if calendar_path exists  
COLUMN_EXISTS=$(sqlite3 "$DB_PATH" "PRAGMA table_info(events);" | grep "calendar_path" | wc -l)
if [ "$COLUMN_EXISTS" -eq 0 ]; then
    echo "Adding calendar_path column..."
    sqlite3 "$DB_PATH" "ALTER TABLE events ADD COLUMN calendar_path TEXT;"
fi

# Check if calendar_name exists
COLUMN_EXISTS=$(sqlite3 "$DB_PATH" "PRAGMA table_info(events);" | grep "calendar_name" | wc -l)
if [ "$COLUMN_EXISTS" -eq 0 ]; then
    echo "Adding calendar_name column..."
    sqlite3 "$DB_PATH" "ALTER TABLE events ADD COLUMN calendar_name TEXT;"
fi

# Check if sync_status exists
COLUMN_EXISTS=$(sqlite3 "$DB_PATH" "PRAGMA table_info(events);" | grep "sync_status" | wc -l)
if [ "$COLUMN_EXISTS" -eq 0 ]; then
    echo "Adding sync_status column..."
    sqlite3 "$DB_PATH" "ALTER TABLE events ADD COLUMN sync_status TEXT DEFAULT 'synced';"
fi

# Check if local_modified exists
COLUMN_EXISTS=$(sqlite3 "$DB_PATH" "PRAGMA table_info(events);" | grep "local_modified" | wc -l)
if [ "$COLUMN_EXISTS" -eq 0 ]; then
    echo "Adding local_modified column..."
    sqlite3 "$DB_PATH" "ALTER TABLE events ADD COLUMN local_modified DATETIME;"
fi

echo "✅ Database migrations complete!"