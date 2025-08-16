# FILENAME MAPPING PLAN

## PROBLEM
- Events created with random filenames like `event-1755360762620-7hqxzedfzc.ics`
- Deletion tries to use UID like `local-1755360762425-yuk3k.ics`
- Result: 404 errors, events stay on iPhone

## SOLUTION
1. **Add `caldav_filename` column to events table** ✅ DONE
2. **Test deletion using correct filename from CalDAV query** ⬅️ NEXT
3. **Update CalDAV creation to store filename mapping**
4. **Update deletion to use stored filename**

## CURRENT EVENTS TO DELETE
- **Multi-Day Test**: `event-1755360762620-7hqxzedfzc.ics` (UID: local-1755360762425-yuk3k)

## TEST DELETION FIRST
Delete Multi-Day Test using correct filename to prove it works.