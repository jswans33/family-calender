# CalDAV Event Fields Reference

## Field Specifications

### Core Fields (Required)

| Field   | Type   | Format                | Description             |
| ------- | ------ | --------------------- | ----------------------- |
| `id`    | string | UUID or unique string | Event unique identifier |
| `title` | string | Plain text            | Event summary/title     |
| `date`  | string | `YYYY-MM-DD`          | Event start date        |
| `time`  | string | `HH:mm` (24-hour)     | Event start time        |

### Extended Fields (Optional)

| Field          | Type     | Format            | Description                         | Example                                     |
| -------------- | -------- | ----------------- | ----------------------------------- | ------------------------------------------- |
| `description`  | string   | Multi-line text   | Event details, notes, or TODO items | `"[ ] Buy milk\n[x] Buy bread"`             |
| `location`     | string   | Plain text        | Physical or virtual location        | `"Conference Room A"`                       |
| `organizer`    | string   | Email format      | Event creator                       | `"john@example.com"`                        |
| `attendees`    | string[] | Array of emails   | Event participants                  | `["jane@example.com", "bob@example.com"]`   |
| `categories`   | string[] | Array of strings  | Event tags/labels                   | `["meeting", "urgent", "todo"]`             |
| `priority`     | number   | 1-9               | Event importance (1=highest)        | `1`                                         |
| `status`       | string   | Enum              | Event status                        | `"CONFIRMED"`, `"TENTATIVE"`, `"CANCELLED"` |
| `visibility`   | string   | Enum              | Event visibility                    | `"PUBLIC"`, `"PRIVATE"`, `"CONFIDENTIAL"`   |
| `dtend`        | string   | ISO 8601          | Event end date/time                 | `"2025-08-20T15:00:00.000Z"`                |
| `duration`     | string   | ISO 8601 Duration | Event duration                      | `"PT1H30M"` (1 hour 30 minutes)             |
| `rrule`        | string   | RFC 5545          | Recurrence rule                     | `"FREQ=WEEKLY;BYDAY=MO,WE,FR"`              |
| `created`      | string   | ISO 8601          | Creation timestamp                  | `"2025-08-15T10:00:00.000Z"`                |
| `lastModified` | string   | ISO 8601          | Last modification time              | `"2025-08-16T14:30:00.000Z"`                |
| `sequence`     | number   | Integer           | Version number                      | `0`, `1`, `2`...                            |
| `url`          | string   | URL format        | Related link                        | `"https://zoom.us/j/123456"`                |
| `geo`          | object   | {lat, lon}        | GPS coordinates                     | `{lat: 37.7749, lon: -122.4194}`            |
| `transparency` | string   | Enum              | Busy/free status                    | `"OPAQUE"` (busy), `"TRANSPARENT"` (free)   |
| `attachments`  | string[] | Array of URLs     | File attachments                    | `["https://example.com/file.pdf"]`          |
| `timezone`     | string   | IANA timezone     | Event timezone                      | `"America/Los_Angeles"`                     |

## Status Values

| Value       | Meaning            | Use Case                            |
| ----------- | ------------------ | ----------------------------------- |
| `CONFIRMED` | Event is confirmed | Default for most events             |
| `TENTATIVE` | Event is tentative | Planning stage events               |
| `CANCELLED` | Event is cancelled | Completed TODOs or cancelled events |

## Priority Levels

| Value | Priority | Typical Use                      |
| ----- | -------- | -------------------------------- |
| 1-3   | High     | Urgent tasks, important meetings |
| 4-6   | Medium   | Regular tasks, standard meetings |
| 7-9   | Low      | Optional events, someday tasks   |

## Duration Format (ISO 8601)

| Format     | Meaning              | Example                                  |
| ---------- | -------------------- | ---------------------------------------- |
| `PT#H`     | Hours                | `PT2H` = 2 hours                         |
| `PT#M`     | Minutes              | `PT30M` = 30 minutes                     |
| `PT#H#M`   | Hours and minutes    | `PT1H30M` = 1 hour 30 minutes            |
| `P#D`      | Days                 | `P1D` = 1 day                            |
| `P#DT#H#M` | Days, hours, minutes | `P1DT2H30M` = 1 day, 2 hours, 30 minutes |

## Recurrence Rules (RRULE)

| Pattern    | RRULE                                | Description              |
| ---------- | ------------------------------------ | ------------------------ |
| Daily      | `FREQ=DAILY`                         | Every day                |
| Weekly     | `FREQ=WEEKLY`                        | Every week               |
| Weekdays   | `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`   | Monday through Friday    |
| Bi-weekly  | `FREQ=WEEKLY;INTERVAL=2`             | Every 2 weeks            |
| Monthly    | `FREQ=MONTHLY`                       | Every month              |
| Yearly     | `FREQ=YEARLY`                        | Every year               |
| Limited    | `FREQ=DAILY;COUNT=10`                | Daily for 10 occurrences |
| Until date | `FREQ=WEEKLY;UNTIL=20251231T235959Z` | Weekly until end of 2025 |

## Categories for TODO System

| Category    | Purpose           | Combined Example                  |
| ----------- | ----------------- | --------------------------------- |
| `todo`      | Mark as task      | `["todo", "shopping"]`            |
| `shopping`  | Shopping list     | `["todo", "shopping", "urgent"]`  |
| `chores`    | Household tasks   | `["todo", "chores", "recurring"]` |
| `homework`  | School work       | `["todo", "homework"]`            |
| `bills`     | Payment reminders | `["todo", "bills", "monthly"]`    |
| `urgent`    | High priority     | `["todo", "urgent"]`              |
| `recurring` | Repeated tasks    | `["todo", "recurring"]`           |

## API Field Mapping

| API Field       | CalDAV Property | iCalendar Property |
| --------------- | --------------- | ------------------ |
| `id`            | Resource name   | UID                |
| `title`         | Summary         | SUMMARY            |
| `date` + `time` | Start datetime  | DTSTART            |
| `description`   | Description     | DESCRIPTION        |
| `location`      | Location        | LOCATION           |
| `organizer`     | Organizer       | ORGANIZER          |
| `attendees`     | Attendees       | ATTENDEE           |
| `categories`    | Categories      | CATEGORIES         |
| `priority`      | Priority        | PRIORITY           |
| `status`        | Status          | STATUS             |
| `dtend`         | End datetime    | DTEND              |
| `duration`      | Duration        | DURATION           |
| `rrule`         | Recurrence      | RRULE              |
| `sequence`      | Sequence        | SEQUENCE           |
| `url`           | URL             | URL                |
| `geo`           | Geo location    | GEO                |

---

📚 This is a **reference** document - designed for looking up specific field information and formats.
