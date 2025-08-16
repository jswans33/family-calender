# Why We Use the SHARED Calendar

## The Discovery

When implementing CalDAV integration with Apple iCloud, we discovered that not all calendars are created equal. Through systematic testing, we found that Apple's CalDAV implementation has different permission models for different calendar types.

## The Problem

Our initial attempts to create events in the user's primary calendars failed:

```
HOME Calendar (/calendars/home/): 500 Internal Server Error
WORK Calendar (/calendars/work/): 500 Internal Server Error  
SHARED Calendar (GUID): 201 Created ✅
```

## Understanding Apple's Calendar Types

Apple iCloud provides several calendar types, each with different characteristics:

### Primary Calendars (Home, Work)
- **Purpose**: Personal calendars tied to the user's Apple ID
- **Permissions**: Read-heavy, limited write access via CalDAV
- **Sync**: Optimized for Apple's native apps
- **CalDAV**: Restricted PUT operations (likely for security)

### Shared Calendars
- **Purpose**: Designed for collaboration between multiple users
- **Permissions**: Full read/write access via CalDAV
- **Sync**: Built for multi-user access patterns
- **CalDAV**: Full CRUD operations supported

## The Solution: Embrace Shared Calendars

Rather than fighting Apple's permission model, we embraced it. The SHARED calendar isn't a workaround - it's actually the perfect solution for a family calendar system.

## Why SHARED is Better for Family Calendars

### 1. Designed for Collaboration
Shared calendars are built from the ground up for multiple users to read and write events. This aligns perfectly with a family calendar where everyone needs to see and modify events.

### 2. Consistent Permissions
Every family member gets the same view and (optionally) the same editing rights. No confusion about who can see or change what.

### 3. CalDAV-Friendly
Apple explicitly allows full CalDAV operations on shared calendars, making our integration robust and future-proof.

### 4. Separation of Concerns
Keeping family events in a dedicated shared calendar means:
- Personal calendars remain private
- Family events don't clutter individual calendars
- Easy to toggle family view on/off

### 5. Better Sync Behavior
Shared calendars are optimized for frequent updates from multiple sources, which suits our bidirectional sync pattern perfectly.

## Technical Benefits

### API Consistency
All operations work consistently:
- CREATE (PUT): ✅ 201 Created
- READ (REPORT): ✅ 200 OK
- UPDATE (PUT): ✅ 204 No Content
- DELETE: ✅ 204 No Content

### Predictable Behavior
No mysterious 500 errors or permission issues. The shared calendar behaves exactly as documented in the CalDAV specification.

### Future-Proof
As Apple designed shared calendars for third-party integration, they're less likely to break this functionality in future updates.

## Philosophy: Work With the Platform

Instead of trying to force our way into the primary calendar (and potentially breaking with each iOS update), we're working with Apple's intended design:

1. **Shared calendars are for sharing** - That's exactly what a family calendar does
2. **Primary calendars are personal** - Respect the user's private space
3. **CalDAV is for integration** - Use it where Apple explicitly supports it

## The Family Calendar Mental Model

Think of it this way:
- Your iPhone has your personal calendar (Home)
- Your family has a shared calendar (like a kitchen wall calendar)
- Our app manages the shared family calendar
- Everyone in the family can see and update it

This mental model is actually more intuitive than mixing family events into personal calendars.

## Conclusion

Using the SHARED calendar isn't a limitation or workaround - it's the architecturally correct choice for a collaborative family calendar system. It provides better permissions, cleaner separation, and more reliable sync behavior than trying to use personal calendars.

By aligning our design with Apple's calendar architecture rather than fighting it, we've created a more robust, maintainable, and user-friendly system.

---

📚 This is an **explanation** document - designed to provide context and understanding about our architectural decisions.