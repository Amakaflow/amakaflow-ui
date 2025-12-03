# Calendar API Integration Guide

## Files Added

1. `src/lib/calendar-api.ts` - API client with all endpoints
2. `src/hooks/useCalendarApi.ts` - React hooks for data fetching

## Setup

1. Copy files to your UI project:
```bash
cd ~/dev/amakaflow-dev-workspace/amakaflow-ui
mkdir -p src/hooks
cp ~/Downloads/ui-api-integration/src/lib/calendar-api.ts src/lib/
cp ~/Downloads/ui-api-integration/src/hooks/useCalendarApi.ts src/hooks/
```

2. Add to `.env`:
```
VITE_CALENDAR_API_URL=http://127.0.0.1:8000
```

## Changes to Calendar.tsx

### 1. Add imports (top of file)

Add:
```typescript
import { useUser } from '@clerk/clerk-react';
import { useCalendarEvents, useConnectedCalendars } from '../hooks/useCalendarApi';
```

Remove:
```typescript
import { getEventsInRange, sampleCalendarEvents, mockConnectedCalendars } from '../lib/calendar-mock-data';
```

### 2. Remove mock data configuration

Delete these lines:
```typescript
const CALENDAR_API_BASE_URL = ...;
const USE_MOCK_DATA = true;
```

### 3. Use hooks in the component

At the top of the `Calendar` function, add:

```typescript
export function Calendar() {
  // Get user from Clerk
  const { user } = useUser();
  const userId = user?.id || '';

  // Calculate week range (keep existing)
  const [currentDate, setCurrentDate] = useState(new Date());
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });

  // Use calendar hooks instead of manual fetching
  const { 
    events, 
    isLoading: loading, 
    error,
    refetch: fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent 
  } = useCalendarEvents({
    start: format(weekStart, 'yyyy-MM-dd'),
    end: format(weekEnd, 'yyyy-MM-dd'),
    userId,
    enabled: !!userId,
  });

  const { 
    calendars: connectedCalendars,
    createCalendar,
    deleteCalendar 
  } = useConnectedCalendars({ userId });

  // ... rest of component
```

### 4. Remove old fetching code

Delete the old `fetchEvents` function and its useEffect:
```typescript
// DELETE THIS:
const fetchEvents = async () => {
  setLoading(true);
  try {
    if (USE_MOCK_DATA) {
      // ... mock data logic
    } else {
      // ... API fetch logic
    }
  } catch (err) {
    ...
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  fetchEvents();
}, [currentDate]);
```

### 5. Update connected calendar filters

Change:
```typescript
const connectedCalendarFilters = mockConnectedCalendars
  .filter(cal => cal.is_workout_calendar)
  ...
```

To:
```typescript
const connectedCalendarFilters = (connectedCalendars || [])
  .filter(cal => cal.is_workout_calendar)
  ...
```

### 6. Update event save handler

Find where events are saved (in EventDialogEnhanced or similar) and update:

```typescript
const handleSaveEvent = async (eventData: CreateWorkoutEvent) => {
  try {
    if (selectedEvent) {
      await updateEvent(selectedEvent.id, eventData);
      toast.success('Event updated');
    } else {
      await createEvent(eventData);
      toast.success('Event created');
    }
    setShowEventDialog(false);
    setSelectedEvent(null);
  } catch (err) {
    toast.error('Failed to save event');
    console.error(err);
  }
};
```

### 7. Update event delete handler

```typescript
const handleDeleteEvent = async (eventId: string) => {
  try {
    await deleteEvent(eventId);
    toast.success('Event deleted');
    setShowEventDrawer(false);
    setSelectedEvent(null);
  } catch (err) {
    toast.error('Failed to delete event');
    console.error(err);
  }
};
```

## API Endpoints

The hooks connect to these endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/calendar?start=&end=` | Get events in date range |
| POST | `/calendar` | Create event |
| PUT | `/calendar/{id}` | Update event |
| DELETE | `/calendar/{id}` | Delete event |
| GET | `/calendar/connected-calendars` | Get connected calendars |
| POST | `/calendar/connected-calendars` | Create connected calendar |
| DELETE | `/calendar/connected-calendars/{id}` | Delete connected calendar |

## Testing

1. Make sure calendar-api is running:
```bash
cd ~/dev/amakaflow-dev-workspace/calendar-api
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

2. Start the UI:
```bash
cd ~/dev/amakaflow-dev-workspace/amakaflow-ui
npm run dev
```

3. Open the Calendar page and check the browser console for any errors.
