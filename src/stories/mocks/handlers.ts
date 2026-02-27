/**
 * MSW request handlers for Storybook.
 * Mocks all backend API calls so screens render with realistic data
 * without needing the backend services running.
 */
import { http, HttpResponse } from 'msw';

const MAPPER = 'http://localhost:8001';
const INGESTOR = 'http://localhost:8004';
const CALENDAR = 'http://localhost:8003';
const CHAT = 'http://localhost:8005';

// ============================================================================
// Sample fixture data
// ============================================================================

const SAMPLE_WORKOUTS = [
  {
    id: 'workout-1',
    user_id: 'user_storybook',
    title: 'Hyrox Session',
    sport: 'HYROX',
    source: 'manual',
    created_at: '2026-02-20T08:00:00Z',
    updated_at: '2026-02-20T08:00:00Z',
    structure: {
      title: 'Hyrox Session',
      blocks: [
        {
          label: 'Warm Up',
          structure: 'circuit',
          exercises: [
            { name: '400m Run', sets: 1, reps: null, duration_sec: 120, type: 'HIIT' },
            { name: 'Hip Circles', sets: 2, reps: 10, duration_sec: null, type: 'Strength' },
          ],
        },
        {
          label: 'Main Set',
          structure: 'for time (cap: 35 min)',
          time_work_sec: 2100,
          exercises: [
            { name: '1000m SkiErg', sets: 1, reps: null, distance_m: 1000, type: 'HIIT' },
            { name: '50m Sled Push', sets: 1, reps: null, distance_m: 50, type: 'Strength' },
            { name: '50m Sled Pull', sets: 1, reps: null, distance_m: 50, type: 'Strength' },
            { name: '80m Burpee Broad Jump', sets: 1, reps: null, distance_m: 80, type: 'HIIT' },
          ],
        },
      ],
    },
    tags: ['hyrox', 'competition'],
  },
  {
    id: 'workout-2',
    user_id: 'user_storybook',
    title: 'Upper Body Strength',
    sport: 'STRENGTH',
    source: 'manual',
    created_at: '2026-02-18T09:30:00Z',
    updated_at: '2026-02-18T09:30:00Z',
    structure: {
      title: 'Upper Body Strength',
      blocks: [
        {
          label: 'Push',
          structure: '5x5',
          exercises: [
            { name: 'Bench Press', sets: 5, reps: 5, load: '80kg', type: 'Strength' },
            { name: 'Overhead Press', sets: 4, reps: 8, load: '50kg', type: 'Strength' },
            { name: 'Dips', sets: 3, reps: 12, type: 'Strength' },
          ],
        },
      ],
    },
    tags: ['strength', 'upper-body'],
  },
  {
    id: 'workout-3',
    user_id: 'user_storybook',
    title: '5K Easy Run',
    sport: 'RUNNING',
    source: 'strava',
    created_at: '2026-02-15T07:00:00Z',
    updated_at: '2026-02-15T07:00:00Z',
    structure: {
      title: '5K Easy Run',
      blocks: [
        {
          label: 'Run',
          structure: 'easy pace',
          exercises: [
            { name: '5km Run', sets: 1, reps: null, distance_m: 5000, type: 'Endurance' },
          ],
        },
      ],
    },
    tags: ['running', 'easy'],
  },
];

const SAMPLE_EXERCISE_MAPPINGS = [
  { id: 'map-1', source_name: '1000m SkiErg', device_name: 'Ski Erg', confidence: 0.95 },
  { id: 'map-2', source_name: 'Sled Push', device_name: 'Sled Push', confidence: 0.99 },
  { id: 'map-3', source_name: 'Bench Press', device_name: 'Bench Press', confidence: 0.99 },
];

// ============================================================================
// Handlers
// ============================================================================

export const handlers = [
  // --- Ingestor API ---
  http.get(`${INGESTOR}/workouts`, () =>
    HttpResponse.json({ workouts: SAMPLE_WORKOUTS, total: SAMPLE_WORKOUTS.length })
  ),
  http.get(`${INGESTOR}/workouts/:id`, ({ params }) =>
    HttpResponse.json(SAMPLE_WORKOUTS.find((w) => w.id === params.id) ?? SAMPLE_WORKOUTS[0])
  ),
  http.post(`${INGESTOR}/workouts`, async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({ ...body, id: 'workout-new', created_at: new Date().toISOString() }, { status: 201 });
  }),
  http.get(`${INGESTOR}/version`, () =>
    HttpResponse.json({ version: '1.0.0-storybook', status: 'ok' })
  ),
  http.get(`${INGESTOR}/health`, () =>
    HttpResponse.json({ status: 'healthy' })
  ),

  // --- Mapper API ---
  http.get(`${MAPPER}/mappings`, () =>
    HttpResponse.json({ mappings: SAMPLE_EXERCISE_MAPPINGS })
  ),
  http.get(`${MAPPER}/health`, () =>
    HttpResponse.json({ status: 'healthy' })
  ),
  http.post(`${MAPPER}/validate`, () =>
    HttpResponse.json({ valid: true, issues: [] })
  ),

  // --- Calendar API ---
  http.get(`${CALENDAR}/events`, () =>
    HttpResponse.json({ events: [] })
  ),
  http.get(`${CALENDAR}/health`, () =>
    HttpResponse.json({ status: 'healthy' })
  ),

  // --- Chat API ---
  http.get(`${CHAT}/health`, () =>
    HttpResponse.json({ status: 'healthy' })
  ),
];
