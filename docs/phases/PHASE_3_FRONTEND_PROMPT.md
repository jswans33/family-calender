# Phase 3: Frontend Multi-Calendar Integration Prompt

## Project Context

You are working on the Swanson Light calendar application - a React frontend with Node.js backend that integrates with Apple CalDAV. You've just completed Phase 2 which implemented full backend multi-calendar support.

**Current State:**
- ✅ Backend supports all 4 CalDAV calendars (Home: 273 events, Work: 43, Shared: 1, Meals: 1)
- ✅ CRUD operations verified 100% successful across all calendars
- ✅ Database schema includes calendar metadata (calendar_path, calendar_name, caldav_filename)
- ✅ API endpoints support calendar parameter (?calendar=home)
- ✅ Quality validation automated with scripts/quality-check.sh

**Architecture:**
```
Frontend (React) → API (/events?calendar=X) → Database (SQLite) → CalDAV (4 calendars)
```

## Phase 3 Goals

Transform the frontend from single-calendar to multi-calendar interface with these features:

### 1. Calendar Selection (Week 1)
- [ ] Add calendar dropdown/tabs to main view
- [ ] Update CalendarService.ts to use calendar parameter
- [ ] Filter events by selected calendar
- [ ] Display calendar event counts in selector

### 2. Visual Calendar Distinction (Week 2)
- [ ] Color-code events by calendar (Home=blue, Work=red, Shared=green, Meals=yellow)
- [ ] Add calendar legend/key
- [ ] Update DayCell.tsx and TimeGrid.tsx for colors
- [ ] Implement multi-calendar event overlays

### 3. Multi-Calendar Management (Week 3)
- [ ] "All Calendars" view showing combined events
- [ ] Calendar toggle checkboxes for selective display
- [ ] Event creation with calendar selection
- [ ] Calendar-specific event editing

### 4. Advanced Features (Week 4)
- [ ] Calendar statistics dashboard
- [ ] Import/export by calendar
- [ ] Calendar-specific search/filtering
- [ ] Mobile-responsive calendar selector

## Technical Implementation

### Key Files to Update:
- `src/services/CalendarService.ts` - Add calendar parameter to API calls
- `src/components/Calendar.tsx` - Add calendar selection state management
- `src/components/primitives/DayCell.tsx` - Color-coding by calendar
- `src/components/primitives/TimeGrid.tsx` - Multi-calendar event display
- `src/types/Calendar.ts` - Update interfaces for calendar metadata

### API Endpoints Available:
- `GET /events` - All events from all calendars
- `GET /events?calendar=home` - Events from specific calendar
- `GET /calendars` - Available calendars with counts
- `POST /events` - Create event (with calendar selection)
- `PUT /events/:id` - Update event
- `DELETE /events/:id` - Delete event

### Quality Gates:
- TypeScript strict mode compliance
- All 4 calendars accessible via UI
- Events properly color-coded
- Mobile responsive design
- No regression in existing functionality

## Success Criteria

**Must Have:**
- Calendar selector component working
- Events color-coded by calendar
- All 4 calendars accessible from frontend
- Create/edit events with calendar selection

**Should Have:**
- "All Calendars" combined view
- Calendar statistics display
- Mobile-responsive design

**Could Have:**
- Advanced filtering options
- Calendar import/export
- Dashboard analytics

## Starting Point

Begin by examining the current frontend architecture:

1. **Review Current State:**
   ```bash
   # Check current React components
   find src/components -name "*.tsx" -exec basename {} \;
   
   # Review current service layer
   cat src/services/CalendarService.ts
   
   # Test current API
   curl "http://localhost:3001/calendars"
   ```

2. **Plan Component Updates:**
   - Calendar.tsx needs calendar selection state
   - CalendarService.ts needs calendar parameter support
   - DayCell.tsx needs color-coding logic
   - New CalendarSelector component required

3. **Verify Backend Integration:**
   - Run `scripts/quality-check.sh` to ensure backend ready
   - Test all 4 calendars via API before frontend work
   - Confirm calendar metadata available

## Files You'll Work With

**Primary Components:**
- `src/components/Calendar.tsx` - Main calendar component
- `src/services/CalendarService.ts` - API service layer
- `src/components/primitives/DayCell.tsx` - Individual day rendering
- `src/components/primitives/TimeGrid.tsx` - Time-based event display

**Supporting Files:**
- `src/types/Calendar.ts` - TypeScript interfaces
- `src/App.tsx` - Root application component
- `package.json` - Dependencies and scripts

**Quality Validation:**
- `scripts/quality-check.sh` - Automated testing
- `logs/` - Verification logs from Phase 2

## Context from Previous Work

**Phase 1:** Basic CalDAV integration with single "Shared" calendar
**Phase 2:** Multi-calendar backend with CRUD verification (just completed)
**Phase 3:** Frontend multi-calendar interface (current phase)

**Key Decisions Made:**
- Using delete-then-create approach for CalDAV updates
- Calendar paths: /home, /work, /2D7581FA-3A83-42D8-B6F4-8BCD8186AA6E (shared), /1fa1e...914 (meals)
- Event IDs used as CalDAV filenames for consistency
- SQLite as local cache with calendar metadata columns

Start by understanding the current frontend structure and planning the calendar selection component.