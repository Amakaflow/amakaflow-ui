# Runna Calendar Sync Guide

## Overview
The Calendar API now supports automatic syncing of Runna training plans via ICS feeds. This allows you to import and sync all your Runna workouts automatically.

## Features
- ✅ Automatic ICS parsing for Runna calendars
- ✅ Extracts workout details (type, distance, duration, etc.)
- ✅ Identifies completed vs planned workouts
- ✅ Updates existing events on re-sync
- ✅ Stores full workout metadata in `json_payload`

## How to Use

### 1. Get Your Runna ICS URL
1. Go to your Runna app
2. Find your calendar subscription URL (usually starts with `https://club.runna.com/`)
3. Copy the ICS URL

### 2. Create a Connected Calendar

```bash
curl -X POST http://localhost:8003/calendar/connected-calendars \
  -H "Content-Type: application/json" \
  -H "X-User-Id: YOUR_USER_ID" \
  -d '{
    "name": "Runna Training Plan",
    "type": "runna",
    "integration_type": "ics_url",
    "is_workout_calendar": true,
    "ics_url": "YOUR_RUNNA_ICS_URL",
    "color": "#FF6B6B"
  }'
```

This returns a response with the calendar `id`:
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Runna Training Plan",
  ...
}
```

### 3. Sync the Calendar

Use the calendar ID from step 2:

```bash
curl -X POST http://localhost:8003/calendar/connected-calendars/123e4567-e89b-12d3-a456-426614174000/sync \
  -H "X-User-Id: YOUR_USER_ID"
```

Response:
```json
{
  "success": true,
  "events_created": 24,
  "events_updated": 0,
  "total_events": 24
}
```

### 4. View Synced Events

```bash
curl "http://localhost:8003/calendar?start=2025-12-01&end=2025-12-31" \
  -H "X-User-Id: YOUR_USER_ID"
```

## What Gets Synced

From each Runna event, we extract:

### Standard Fields
- `title`: e.g., "5.5mi Easy Run", "Rolling 800s"
- `date`: Workout date
- `start_time` / `end_time`: If specified in the ICS
- `type`: Workout type (run, hyrox, etc.)
- `status`: "planned" or "completed"
- `external_event_url`: Link to the workout in Runna app

### Extended Data (in `json_payload`)
- `ics_uid`: Unique identifier from Runna
- `description`: Full workout description
- `estimated_duration`: Duration in seconds
- `distance_mi`: Distance in miles (extracted from title)
- `location`: Workout location if specified

## Workout Type Detection

The parser automatically detects workout types:
- **Easy Run**: `_EASY_RUN_` in UID or "Easy Run" in title
- **Tempo**: `_TEMPO_` in UID or "Tempo" in title
- **Intervals**: `_INTERVALS_` in UID or "Intervals"/"Repeats" in title
- **Long Run**: `_LONG_RUN_` in UID or "Long Run" in title
- **Race**: `_RACE_` in UID or "Race" in title
- **HYROX**: "HYROX" in title

## UI Integration

To add sync functionality to your UI:

```typescript
import { calendarApi } from '../lib/calendar-api';

// Sync calendar
const syncCalendar = async (calendarId: string) => {
  try {
    const result = await calendarApi.syncConnectedCalendar(calendarId);
    console.log(`Synced ${result.events_created} new events`);
  } catch (error) {
    console.error('Sync failed:', error);
  }
};
```

You'll need to add this method to `calendar-api.ts`:

```typescript
async syncConnectedCalendar(calendarId: string): Promise<{
  success: boolean;
  events_created: number;
  events_updated: number;
  total_events: number;
}> {
  const response = await fetch(
    `${this.baseURL}/calendar/connected-calendars/${calendarId}/sync`,
    {
      method: 'POST',
      headers: this.getHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(`Sync failed: ${response.statusText}`);
  }

  return response.json();
}
```

## Error Handling

The sync endpoint updates the calendar's `sync_status` field:
- **active**: Last sync successful
- **error**: Last sync failed (check `sync_error_message`)

If sync fails, the `connected_calendars` table records the error:
- `sync_status`: "error"
- `sync_error_message`: Error details
- `last_sync`: When the failed attempt occurred

## Re-syncing

Running sync multiple times is safe:
- Existing events are updated (matched by `ics_uid`)
- New events are created
- No duplicates are created

## Files Modified

1. [ics_parser.py](app/utils/ics_parser.py) - ICS parsing utility
2. [calendar.py:246](app/routes/calendar.py#L246) - Sync endpoint
3. [requirements.txt](requirements.txt) - Added httpx dependency

## Testing

### API Testing

Verify the sync endpoint is available:
```bash
curl http://localhost:8003/openapi.json | grep -A 5 sync
```

Should show: `POST /calendar/connected-calendars/{calendar_id}/sync`

### UI Testing

The Runna sync functionality is integrated into the main Calendar page:

1. Start the UI (if not already running):
```bash
cd ~/dev/amakaflow-dev-workspace/amakaflow-ui
npm run dev
```

2. Navigate to the "Calendar" tab

3. Add your Runna calendar:
   - Click the "New" dropdown button
   - Select "Add from Connected Calendar..."
   - Click "Add Runna Calendar"
   - Enter a calendar name (e.g., "My Runna Plan")
   - Paste your Runna ICS URL
   - Click "Connect Calendar"

4. Sync the calendar:
   - The Connected Calendars modal will show your calendar
   - Click the "Sync" button next to your calendar
   - Watch for the success toast: "Synced X new events, updated Y"

5. View synced events:
   - Your Runna workouts now appear on the calendar
   - They're automatically filtered in the "Workout Sources" sidebar
   - Click on any event to see full details
