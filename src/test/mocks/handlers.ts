/**
 * MSW handlers for all backend API endpoints consumed by amakaflow-ui.
 *
 * This file serves as the API CONTRACT REGISTRY — every handler documents
 * the expected response shape. If the backend changes a response format,
 * MSW-based tests fail immediately (the "locking layer").
 *
 * Organised by backend service, matching the frontend lib file structure.
 *
 * Usage:
 *   // In setup.ts (already wired):
 *   beforeAll(() => server.listen());
 *
 *   // Override per test:
 *   server.use(
 *     http.get(`${MAPPER}/workouts`, () => HttpResponse.json({ error: 'fail' }, { status: 500 }))
 *   );
 */
import { http, HttpResponse } from 'msw';

// Base URLs (must match src/lib/config.ts defaults)
const MAPPER = 'http://localhost:8001';
const INGESTOR = 'http://localhost:8004';
const CALENDAR = 'http://localhost:8003';
const CHAT = 'http://localhost:8005';
const STRAVA = 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Known IDs — shared across dynamic mock handlers
// ---------------------------------------------------------------------------

/** Exercise IDs that return data (others get 404). Matches progression-e2e.fixtures.ts. */
export const KNOWN_EXERCISE_IDS = [
  'ex-001', 'ex-002',
  'barbell-bench-press', 'barbell-squat', 'deadlift',
];

/** Exercise IDs that exist but have no weight history (bodyweight). */
export const BODYWEIGHT_EXERCISE_IDS = ['pull-up', 'plank'];

/** Workout IDs that return data from the mix endpoint. Matches mix-workouts-smoke fixtures. */
export const KNOWN_WORKOUT_IDS = [
  '480de2f4-9785-47aa-83ac-4fdc0254f5de',
  'c3e654d9-b44f-47f4-86ec-c2a0acf516d3',
  'workout-001',
  'workout-002',
];

// ---------------------------------------------------------------------------
// Sample data — minimal but structurally correct
// ---------------------------------------------------------------------------

const SAMPLE_WORKOUT = {
  id: 'workout-001',
  title: 'Test Workout',
  description: 'MSW mock workout',
  blocks: [
    {
      label: 'Main',
      structure: 'straight',
      exercises: [
        { name: 'Squat', sets: 3, reps: 10 },
        { name: 'Bench Press', sets: 3, reps: 8 },
      ],
    },
  ],
  tags: [],
  sources: ['manual'],
  is_favorite: false,
  created_at: '2025-01-15T10:00:00Z',
};

const SAMPLE_PROGRAM = {
  id: 'prog-001',
  name: 'Test Program',
  description: 'MSW mock program',
  color: '#FF5733',
  is_active: true,
  members: [],
  created_at: '2025-01-15T10:00:00Z',
};

const SAMPLE_TAG = {
  id: 'tag-001',
  name: 'Strength',
  color: '#3498DB',
};

const SAMPLE_COMPLETION = {
  id: 'comp-001',
  workout_name: 'Test Workout',
  started_at: '2025-01-15T10:00:00Z',
  duration_seconds: 2700,
  source: 'apple_watch',
};

const SAMPLE_EXERCISE_HISTORY = {
  exercise_id: 'ex-001',
  exercise_name: 'Squat',
  session_count: 12,
  supports_1rm: true,
  one_rm_formula: 'epley',
  total_sessions: 12,
  all_time_best_1rm: 133,
  all_time_max_weight: 120,
  sessions: [
    {
      completion_id: 'comp-001',
      workout_date: '2025-01-15T10:00:00Z',
      workout_name: 'Leg Day',
      exercise_name: 'Squat',
      sets: [
        {
          set_number: 1,
          weight: 100,
          weight_unit: 'kg',
          reps_completed: 10,
          reps_planned: 10,
          status: 'completed',
          estimated_1rm: 133,
          is_pr: false,
        },
      ],
      session_best_1rm: 133,
      session_max_weight: 100,
      session_total_volume: 3000,
    },
  ],
};

const SAMPLE_PERSONAL_RECORD = {
  id: 'pr-001',
  exercise_id: 'ex-001',
  exercise_name: 'Bench Press',
  record_type: '1rm',
  value: 100,
  unit: 'kg',
  achieved_at: '2025-01-15T10:00:00Z',
  completion_id: 'comp-001',
  details: null,
};

const SAMPLE_CALENDAR_EVENT = {
  id: 'event-001',
  title: 'Morning Workout',
  start: '2025-01-15T08:00:00Z',
  end: '2025-01-15T09:00:00Z',
  type: 'workout',
  workout_id: 'workout-001',
};

const SAMPLE_CHAT_SESSION = {
  id: 'session-001',
  title: 'Workout Planning',
  created_at: '2025-01-15T10:00:00Z',
  updated_at: '2025-01-15T10:30:00Z',
  message_count: 5,
};

const SAMPLE_CHAT_MESSAGE = {
  id: 'msg-001',
  role: 'assistant',
  content: 'Here is your workout plan.',
  created_at: '2025-01-15T10:00:00Z',
};

const SAMPLE_COACH_MEMORY = {
  id: 'mem-001',
  content: 'User prefers morning workouts',
  category: 'preference',
  created_at: '2025-01-15T10:00:00Z',
};

const SAMPLE_BADGE = {
  id: 'badge-001',
  name: 'First Workout',
  description: 'Complete your first workout',
  icon: 'trophy',
  earned_at: '2025-01-15T10:00:00Z',
};

const SAMPLE_KNOWLEDGE_CARD = {
  id: 'card-001',
  title: 'Progressive Overload',
  content: 'Gradually increase training stimulus over time.',
  tags: ['training', 'principles'],
  created_at: '2025-01-15T10:00:00Z',
};

const SAMPLE_SOCIAL_POST = {
  id: 'post-001',
  author_id: 'user-001',
  content: 'Great workout today!',
  reactions: [],
  comment_count: 0,
  created_at: '2025-01-15T10:00:00Z',
};

const SAMPLE_CHALLENGE = {
  id: 'challenge-001',
  name: 'January Streak',
  description: 'Work out every day in January',
  start_date: '2025-01-01',
  end_date: '2025-01-31',
  participants: 5,
};

const SAMPLE_CREW = {
  id: 'crew-001',
  name: 'Morning Warriors',
  member_count: 8,
  created_at: '2025-01-15T10:00:00Z',
};

const SAMPLE_DAY_STATE = {
  date: '2025-01-15',
  status: 'training',
  sessions: [],
  notes: '',
};

const SAMPLE_PENDING_ACTION = {
  id: 'action-001',
  type: 'move_session',
  description: 'Move session from Monday to Tuesday',
  status: 'pending',
  created_at: '2025-01-15T10:00:00Z',
};

const SAMPLE_CLIP = {
  id: 'clip-001',
  url: 'https://example.com/workout',
  title: 'Saved Workout',
  created_at: '2025-01-15T10:00:00Z',
};

// ---------------------------------------------------------------------------
// MAPPER-API handlers (port 8001)
// ---------------------------------------------------------------------------

const mapperHandlers = [
  // Health
  http.get(`${MAPPER}/health`, () =>
    HttpResponse.json({ status: 'ok' }),
  ),

  // --- Workouts ---
  http.get(`${MAPPER}/workouts`, () =>
    HttpResponse.json([SAMPLE_WORKOUT]),
  ),
  http.get(`${MAPPER}/workouts/search`, () =>
    HttpResponse.json({
      success: true,
      results: [
        { workout_id: 'workout-001', title: 'Test', similarity_score: 0.95 },
      ],
      count: 1,
      query: 'test',
      search_type: 'semantic',
    }),
  ),
  http.get(`${MAPPER}/workouts/incoming`, () =>
    HttpResponse.json([]),
  ),
  http.get(`${MAPPER}/workouts/:id/follow-along`, () =>
    HttpResponse.json({ workout: SAMPLE_WORKOUT }),
  ),
  http.get(`${MAPPER}/workouts/:id/sync-status`, () =>
    HttpResponse.json({ status: 'synced', synced_at: '2025-01-15T10:00:00Z' }),
  ),
  http.get(`${MAPPER}/workouts/:id`, () =>
    HttpResponse.json(SAMPLE_WORKOUT),
  ),
  http.post(`${MAPPER}/workouts/save`, () =>
    HttpResponse.json({ ...SAMPLE_WORKOUT, id: 'workout-new' }),
  ),
  http.post(`${MAPPER}/workouts/complete`, () =>
    HttpResponse.json({ success: true, completion: SAMPLE_COMPLETION }),
  ),
  http.put(`${MAPPER}/workouts/:id`, () =>
    HttpResponse.json(SAMPLE_WORKOUT),
  ),
  http.delete(`${MAPPER}/workouts/:id`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.put(`${MAPPER}/workouts/:id/export-status`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.patch(`${MAPPER}/workouts/:id/favorite`, () =>
    HttpResponse.json({ ...SAMPLE_WORKOUT, is_favorite: true }),
  ),
  http.patch(`${MAPPER}/workouts/:id/used`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.patch(`${MAPPER}/workouts/:id/tags`, () =>
    HttpResponse.json({ success: true }),
  ),

  // --- Completions ---
  http.get(`${MAPPER}/workouts/completions`, () =>
    HttpResponse.json({
      success: true,
      completions: [SAMPLE_COMPLETION],
      total: 1,
    }),
  ),
  http.post(`${MAPPER}/workouts/completions`, () =>
    HttpResponse.json({ success: true, completion: SAMPLE_COMPLETION }),
  ),
  http.get(`${MAPPER}/workouts/completions/:id`, () =>
    HttpResponse.json({ success: true, completion: SAMPLE_COMPLETION }),
  ),

  // --- Programs ---
  http.get(`${MAPPER}/programs`, () =>
    HttpResponse.json([SAMPLE_PROGRAM]),
  ),
  http.get(`${MAPPER}/programs/:id`, () =>
    HttpResponse.json(SAMPLE_PROGRAM),
  ),
  http.post(`${MAPPER}/programs`, () =>
    HttpResponse.json(SAMPLE_PROGRAM),
  ),
  http.patch(`${MAPPER}/programs/:id`, () =>
    HttpResponse.json(SAMPLE_PROGRAM),
  ),
  http.delete(`${MAPPER}/programs/:id`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${MAPPER}/programs/:id/members`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.delete(`${MAPPER}/programs/:id/members/:memberId`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${MAPPER}/programs/generate`, () =>
    HttpResponse.json({ job_id: 'job-001', status: 'queued' }),
  ),
  http.get(`${MAPPER}/programs/generate/:jobId/status`, () =>
    HttpResponse.json({ status: 'completed', program: SAMPLE_PROGRAM }),
  ),

  // --- Tags ---
  http.get(`${MAPPER}/tags`, () =>
    HttpResponse.json([SAMPLE_TAG]),
  ),
  http.post(`${MAPPER}/tags`, () =>
    HttpResponse.json(SAMPLE_TAG),
  ),
  http.delete(`${MAPPER}/tags/:id`, () =>
    HttpResponse.json({ success: true }),
  ),

  // --- Progression tracking ---
  http.get(`${MAPPER}/progression/exercises`, () =>
    HttpResponse.json({
      exercises: [
        { exercise_id: 'ex-001', exercise_name: 'Squat', session_count: 12 },
        { exercise_id: 'ex-002', exercise_name: 'Bench Press', session_count: 8 },
      ],
      total: 2,
    }),
  ),
  http.get(`${MAPPER}/progression/exercises/:exerciseId/history`, ({ params, request }) => {
    const exerciseId = params.exerciseId as string;
    const url = new URL(request.url);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const knownExercises = KNOWN_EXERCISE_IDS;
    // Bodyweight / no-history exercises — return empty sessions
    if (BODYWEIGHT_EXERCISE_IDS.includes(exerciseId)) {
      return HttpResponse.json({
        exercise_id: exerciseId,
        exercise_name: 'Pull Up',
        session_count: 0,
        supports_1rm: false,
        one_rm_formula: 'brzycki',
        total_sessions: 0,
        all_time_best_1rm: null,
        all_time_max_weight: null,
        sessions: [],
      });
    }
    if (knownExercises.includes(exerciseId)) {
      const history = {
        ...SAMPLE_EXERCISE_HISTORY,
        exercise_id: exerciseId,
        exercise_name: exerciseId === 'barbell-bench-press' ? 'Barbell Bench Press' : 'Squat',
      };
      // Simulate pagination: offset > 0 returns a different session
      if (offset > 0) {
        history.sessions = [
          {
            ...SAMPLE_EXERCISE_HISTORY.sessions[0],
            completion_id: `comp-page2-${offset}`,
            workout_date: '2025-01-10T10:00:00Z',
            workout_name: 'Earlier Workout',
          },
        ];
      }
      return HttpResponse.json(history);
    }
    return HttpResponse.json({ detail: 'Exercise not found' }, { status: 404 });
  }),
  http.get(`${MAPPER}/progression/exercises/:exerciseId/last-weight`, ({ params }) => {
    const exerciseId = params.exerciseId as string;
    const knownExercises = KNOWN_EXERCISE_IDS;
    if (knownExercises.includes(exerciseId)) {
      return HttpResponse.json({
        exercise_id: exerciseId,
        exercise_name: exerciseId === 'barbell-bench-press' ? 'Barbell Bench Press' : 'Squat',
        weight: 175,
        weight_unit: 'lbs',
        reps_completed: 6,
        workout_date: '2026-01-15',
        completion_id: 'comp-e2e-001',
      });
    }
    return HttpResponse.json({ detail: 'No weight history found' }, { status: 404 });
  }),
  http.get(`${MAPPER}/progression/records`, ({ request }) => {
    const url = new URL(request.url);
    const recordType = url.searchParams.get('record_type');
    const exerciseId = url.searchParams.get('exercise_id');
    const limit = url.searchParams.get('limit');

    // Full set of mock records covering all types — matches progression-e2e.fixtures.ts
    const allRecords = [
      {
        id: 'pr-001',
        exercise_id: 'barbell-bench-press',
        exercise_name: 'Barbell Bench Press',
        record_type: '1rm',
        value: 203,
        unit: 'lbs',
        achieved_at: '2026-01-15T10:00:00Z',
        completion_id: 'comp-e2e-001',
        details: null,
      },
      {
        id: 'pr-002',
        exercise_id: 'barbell-bench-press',
        exercise_name: 'Barbell Bench Press',
        record_type: 'max_weight',
        value: 175,
        unit: 'lbs',
        achieved_at: '2026-01-15T10:00:00Z',
        completion_id: 'comp-e2e-001',
        details: null,
      },
      {
        id: 'pr-003',
        exercise_id: 'barbell-bench-press',
        exercise_name: 'Barbell Bench Press',
        record_type: 'max_reps',
        value: 10,
        unit: 'reps',
        achieved_at: '2026-01-15T10:00:00Z',
        completion_id: 'comp-e2e-001',
        details: null,
      },
      {
        id: 'pr-004',
        exercise_id: 'barbell-squat',
        exercise_name: 'Barbell Squat',
        record_type: '1rm',
        value: 253,
        unit: 'lbs',
        achieved_at: '2026-01-12T10:00:00Z',
        completion_id: 'comp-e2e-003',
        details: null,
      },
      {
        id: 'pr-005',
        exercise_id: 'barbell-squat',
        exercise_name: 'Barbell Squat',
        record_type: 'max_weight',
        value: 225,
        unit: 'lbs',
        achieved_at: '2026-01-12T10:00:00Z',
        completion_id: 'comp-e2e-003',
        details: null,
      },
    ];

    let filtered = allRecords;
    if (recordType) {
      filtered = filtered.filter((r) => r.record_type === recordType);
    }
    if (exerciseId) {
      filtered = filtered.filter((r) => r.exercise_id === exerciseId);
    }
    if (limit) {
      filtered = filtered.slice(0, parseInt(limit, 10));
    }

    return HttpResponse.json({
      records: filtered,
      exercise_id: exerciseId || null,
      total: filtered.length,
    });
  }),
  http.get(`${MAPPER}/progression/volume`, () =>
    HttpResponse.json({
      data: [
        { period: '2025-W03', muscle_group: 'chest', total_volume: 15000, total_sets: 12, total_reps: 96 },
      ],
      summary: {
        total_volume: 15000,
        total_sets: 12,
        total_reps: 96,
        muscle_group_breakdown: { chest: 15000 },
      },
      period: {
        start_date: '2025-01-01',
        end_date: '2025-01-31',
      },
      granularity: 'weekly',
    }),
  ),

  // --- Mapping / Workflow / Export ---
  http.post(`${MAPPER}/workflow/validate`, () =>
    HttpResponse.json({ valid: true, exercises: [] }),
  ),
  http.post(`${MAPPER}/workflow/process`, () =>
    HttpResponse.json({ success: true, workout: SAMPLE_WORKOUT }),
  ),
  http.post(`${MAPPER}/workflow/process-with-review`, () =>
    HttpResponse.json({ success: true, workout: SAMPLE_WORKOUT, review_needed: [] }),
  ),
  http.post(`${MAPPER}/map/auto-map`, () =>
    HttpResponse.json({ yaml: 'workout:\n  name: Test' }),
  ),
  http.post(`${MAPPER}/map/to-workoutkit`, () =>
    HttpResponse.json({ customWorkout: {} }),
  ),
  http.post(`${MAPPER}/map/to-zwo`, () =>
    HttpResponse.json({ zwo: '<workout_file/>' }),
  ),
  http.post(`${MAPPER}/map/to-fit`, () =>
    new HttpResponse(new ArrayBuffer(100), {
      headers: { 'Content-Type': 'application/octet-stream' },
    }),
  ),
  http.post(`${MAPPER}/map/fit-metadata`, () =>
    HttpResponse.json({ sport: 'running', sub_sport: 'generic' }),
  ),
  http.post(`${MAPPER}/map/preview-steps`, () =>
    HttpResponse.json({ steps: [] }),
  ),
  http.post(`${MAPPER}/map/workout`, () =>
    HttpResponse.json({ success: true, workout: SAMPLE_WORKOUT }),
  ),
  http.post(`${MAPPER}/map/to-hiit`, () =>
    HttpResponse.json({ hiit: {} }),
  ),
  http.post(`${MAPPER}/map/blocks-to-hyrox`, () =>
    HttpResponse.json({ hyrox: {} }),
  ),
  http.post(`${MAPPER}/map/final`, () =>
    HttpResponse.json({ success: true, workout: SAMPLE_WORKOUT }),
  ),
  http.post(`${MAPPER}/map-parsed`, () =>
    HttpResponse.json({ success: true, workout: SAMPLE_WORKOUT }),
  ),

  // --- Exercise search / suggest / mapping ---
  http.post(`${MAPPER}/exercise/suggest`, () =>
    HttpResponse.json({ suggestions: [] }),
  ),
  http.get(`${MAPPER}/exercise/similar/:exerciseName`, () =>
    HttpResponse.json([]),
  ),
  http.get(`${MAPPER}/exercise/by-type/:exerciseName`, () =>
    HttpResponse.json([]),
  ),
  http.post(`${MAPPER}/exercises/match`, () =>
    HttpResponse.json({ match: null, confidence: 0 }),
  ),
  http.post(`${MAPPER}/exercises/match/batch`, () =>
    HttpResponse.json({ matches: [] }),
  ),
  http.get(`${MAPPER}/search`, () =>
    HttpResponse.json([]),
  ),
  http.post(`${MAPPER}/canonical/match/fuzzy`, () =>
    HttpResponse.json({ matches: [] }),
  ),
  http.post(`${MAPPER}/classify`, () =>
    HttpResponse.json({ category: 'strength', muscle_groups: ['chest'] }),
  ),
  http.post(`${MAPPER}/canonical/match`, () =>
    HttpResponse.json({ match: null }),
  ),
  http.post(`${MAPPER}/canonical/match/batch`, () =>
    HttpResponse.json({ matches: [] }),
  ),
  http.get(`${MAPPER}/canonical/suggest`, () =>
    HttpResponse.json([]),
  ),
  http.get(`${MAPPER}/canonical/:exerciseId`, () =>
    HttpResponse.json({ id: 'ex-001', name: 'Squat', category: 'strength' }),
  ),
  http.get(`${MAPPER}/canonical`, () =>
    HttpResponse.json([]),
  ),

  // --- User mappings ---
  http.get(`${MAPPER}/mappings`, () =>
    HttpResponse.json([]),
  ),
  http.post(`${MAPPER}/mappings/add`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.delete(`${MAPPER}/mappings/remove/:exerciseName`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${MAPPER}/mappings/lookup/:exerciseName`, () =>
    HttpResponse.json(null),
  ),
  http.delete(`${MAPPER}/mappings/clear`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${MAPPER}/mappings/popularity/stats`, () =>
    HttpResponse.json({ total_recordings: 0 }),
  ),
  http.get(`${MAPPER}/mappings/popularity/:exerciseName`, () =>
    HttpResponse.json({ count: 0 }),
  ),
  http.post(`${MAPPER}/mappings/popularity/record`, () =>
    HttpResponse.json({ success: true }),
  ),

  // --- Follow-along ---
  http.get(`${MAPPER}/follow-along/active`, () =>
    HttpResponse.json(null),
  ),
  http.get(`${MAPPER}/follow-along`, () =>
    HttpResponse.json([]),
  ),
  http.get(`${MAPPER}/follow-along/:id`, () =>
    HttpResponse.json({ id: 'fa-001', workout: SAMPLE_WORKOUT }),
  ),
  http.post(`${MAPPER}/follow-along/workouts`, () =>
    HttpResponse.json({ id: 'fa-001' }),
  ),
  http.post(`${MAPPER}/follow-along/create`, () =>
    HttpResponse.json({ id: 'fa-001' }),
  ),
  http.post(`${MAPPER}/follow-along/ingest`, () =>
    HttpResponse.json({ id: 'fa-001' }),
  ),
  http.post(`${MAPPER}/follow-along/:id/start`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${MAPPER}/follow-along/:id/pause`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${MAPPER}/follow-along/:id/resume`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${MAPPER}/follow-along/:id/end`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${MAPPER}/follow-along/:id/checkpoint`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${MAPPER}/follow-along/video/stream`, () =>
    new HttpResponse('data: {"type":"segment","content":"warmup"}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    }),
  ),
  http.post(`${MAPPER}/follow-along/segments/:segmentId/skip`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.delete(`${MAPPER}/follow-along/sessions/:sessionId`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.delete(`${MAPPER}/follow-along/:id`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${MAPPER}/follow-along/:id/push/garmin`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${MAPPER}/follow-along/:id/push/apple-watch`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${MAPPER}/follow-along/:id/push/ios-companion`, () =>
    HttpResponse.json({ success: true }),
  ),

  // --- Bulk import ---
  http.post(`${MAPPER}/bulk/detect`, () =>
    HttpResponse.json({ format: 'text', confidence: 0.9 }),
  ),
  http.post(`${MAPPER}/bulk/detect/file`, () =>
    HttpResponse.json({ format: 'csv', confidence: 0.95 }),
  ),
  http.post(`${MAPPER}/bulk/extract`, () =>
    HttpResponse.json({ workouts: [SAMPLE_WORKOUT] }),
  ),
  http.post(`${MAPPER}/bulk/preview`, () =>
    HttpResponse.json({ workouts: [SAMPLE_WORKOUT], total: 1 }),
  ),
  http.post(`${MAPPER}/bulk/validate`, () =>
    HttpResponse.json({ valid: true, errors: [] }),
  ),
  http.post(`${MAPPER}/bulk/import`, () =>
    HttpResponse.json({ success: true, imported: 1 }),
  ),
  http.post(`${MAPPER}/bulk/import/async`, () =>
    HttpResponse.json({ job_id: 'bulk-001', status: 'queued' }),
  ),
  http.post(`${MAPPER}/bulk/cancel`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${MAPPER}/bulk/status/:jobId`, () =>
    HttpResponse.json({ status: 'completed', imported: 1 }),
  ),
  http.post(`${MAPPER}/bulk/items/:itemId/skip`, () =>
    HttpResponse.json({ success: true }),
  ),

  // --- Clip queue ---
  http.get(`${MAPPER}/clips`, () =>
    HttpResponse.json([SAMPLE_CLIP]),
  ),
  http.post(`${MAPPER}/clips`, () =>
    HttpResponse.json(SAMPLE_CLIP),
  ),
  http.delete(`${MAPPER}/clips/:clipId`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${MAPPER}/clips/:clipId/import`, () =>
    HttpResponse.json({ success: true, workout: SAMPLE_WORKOUT }),
  ),

  // --- Workout enrichment ---
  http.post(`${MAPPER}/workout/enrich`, () =>
    HttpResponse.json({ workout: SAMPLE_WORKOUT }),
  ),
  http.get(`${MAPPER}/user/workout-preferences`, () =>
    HttpResponse.json({ warmup: true, cooldown: true, rest_seconds: 60 }),
  ),
  http.put(`${MAPPER}/user/workout-preferences`, () =>
    HttpResponse.json({ warmup: true, cooldown: true, rest_seconds: 60 }),
  ),

  // --- Chat (mapper-side) ---
  http.post(`${MAPPER}/chat/stream`, () =>
    new HttpResponse('data: {"type":"text","content":"Hello"}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    }),
  ),

  // --- Mobile pairing ---
  http.post(`${MAPPER}/mobile/pairing/generate`, () =>
    HttpResponse.json({
      token: 'pair-token-001',
      short_code: 'ABC123',
      qr_data: '{"type":"amakaflow_pairing"}',
      expires_at: '2025-01-15T10:05:00Z',
      expires_in_seconds: 300,
    }),
  ),
  http.post(`${MAPPER}/mobile/pairing/pair`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${MAPPER}/mobile/pairing/refresh`, () =>
    HttpResponse.json({ token: 'refreshed-token', expires_at: '2025-01-15T11:00:00Z' }),
  ),
  http.get(`${MAPPER}/mobile/pairing/status/:token`, () =>
    HttpResponse.json({ status: 'pending' }),
  ),
  http.delete(`${MAPPER}/mobile/pairing/revoke`, () =>
    HttpResponse.json({ revoked: 0 }),
  ),
  http.get(`${MAPPER}/mobile/pairing/devices`, () =>
    HttpResponse.json([]),
  ),
  http.delete(`${MAPPER}/mobile/pairing/devices/:deviceId`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${MAPPER}/mobile/devices/register-push-token`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${MAPPER}/mobile/devices/push-tokens`, () =>
    HttpResponse.json([]),
  ),
  http.get(`${MAPPER}/mobile/profile`, () =>
    HttpResponse.json({ id: 'user-001', name: 'Test User' }),
  ),

  // --- Garmin device pairing ---
  http.post(`${MAPPER}/api/garmin/pair/request`, () =>
    HttpResponse.json({ polling_token: 'garmin-poll-001' }),
  ),
  http.get(`${MAPPER}/api/garmin/pair/status/:pollingToken`, () =>
    HttpResponse.json({ status: 'pending' }),
  ),
  http.post(`${MAPPER}/api/garmin/pair/confirm`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${MAPPER}/api/garmin/workouts/fit/:workoutId`, () =>
    new HttpResponse(new ArrayBuffer(100), {
      headers: { 'Content-Type': 'application/octet-stream' },
    }),
  ),
  http.get(`${MAPPER}/api/garmin/workouts`, () =>
    HttpResponse.json([]),
  ),
  http.post(`${MAPPER}/api/garmin/workouts/queue`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${MAPPER}/api/garmin/workouts/dequeue`, () =>
    HttpResponse.json({ success: true }),
  ),

  // --- Device sync ---
  http.post(`${MAPPER}/workouts/:workoutId/push/ios-companion`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${MAPPER}/ios-companion/pending`, () =>
    HttpResponse.json([]),
  ),
  http.post(`${MAPPER}/workouts/:workoutId/push/android-companion`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${MAPPER}/android-companion/pending`, () =>
    HttpResponse.json([]),
  ),
  http.post(`${MAPPER}/workout/sync/garmin`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${MAPPER}/workouts/:workoutId/sync`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${MAPPER}/sync/pending`, () =>
    HttpResponse.json([]),
  ),
  http.post(`${MAPPER}/sync/confirm`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${MAPPER}/sync/failed`, () =>
    HttpResponse.json({ success: true }),
  ),

  // --- Stryd ---
  http.post(`${MAPPER}/stryd/import`, () =>
    HttpResponse.json({ success: true, workout: SAMPLE_WORKOUT }),
  ),

  // --- Account ---
  http.get(`${MAPPER}/deletion-preview`, () =>
    HttpResponse.json({ workouts: 10, completions: 5, mappings: 3 }),
  ),
  http.get(`${MAPPER}/account/deletion-preview`, () =>
    HttpResponse.json({ workouts: 10, completions: 5, mappings: 3 }),
  ),
  http.delete(`${MAPPER}/account`, () =>
    HttpResponse.json({ success: true, deleted: { workouts: 10 } }),
  ),
  http.post(`${MAPPER}/testing/reset-user-data`, () =>
    HttpResponse.json({ success: true }),
  ),

  // --- Settings ---
  http.get(`${MAPPER}/user/voice-corrections`, () =>
    HttpResponse.json([]),
  ),
  http.put(`${MAPPER}/user/voice-corrections`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${MAPPER}/user/settings`, () =>
    HttpResponse.json({ distance_unit: 'miles', weight_unit: 'lbs', exercise_value: 'reps' }),
  ),
  http.put(`${MAPPER}/user/settings`, () =>
    HttpResponse.json({ distance_unit: 'miles', weight_unit: 'lbs', exercise_value: 'reps' }),
  ),
  http.get(`${MAPPER}/settings/defaults`, () =>
    HttpResponse.json({ distance_unit: 'miles', weight_unit: 'lbs', exercise_value: 'reps' }),
  ),
  http.put(`${MAPPER}/settings/defaults`, () =>
    HttpResponse.json({ distance_unit: 'miles', weight_unit: 'lbs', exercise_value: 'reps' }),
  ),

  // --- Debug ---
  http.get(`${MAPPER}/debug/garmin-test`, () =>
    HttpResponse.json({ success: true }),
  ),
];

// ---------------------------------------------------------------------------
// INGESTOR handlers (port 8004)
// ---------------------------------------------------------------------------

const ingestorHandlers = [
  // Health
  http.get(`${INGESTOR}/version`, () =>
    HttpResponse.json({ version: '1.0.0' }),
  ),
  http.get(`${INGESTOR}/health`, () =>
    HttpResponse.json({ status: 'ok', ok: true }),
  ),

  // --- Ingestion routes ---
  http.post(`${INGESTOR}/ingest/text`, () =>
    HttpResponse.json({ success: true, workout: SAMPLE_WORKOUT }),
  ),
  http.post(`${INGESTOR}/ingest/json`, () =>
    HttpResponse.json({ success: true, workout: SAMPLE_WORKOUT }),
  ),
  http.post(`${INGESTOR}/ingest/ai_workout`, () =>
    HttpResponse.json({ success: true, workout: SAMPLE_WORKOUT }),
  ),
  http.post(`${INGESTOR}/transform/freeform-to-canonical`, () =>
    HttpResponse.json({ workout: SAMPLE_WORKOUT }),
  ),
  http.post(`${INGESTOR}/ingest/image`, () =>
    HttpResponse.json({ success: true, workout: SAMPLE_WORKOUT }),
  ),
  http.post(`${INGESTOR}/ingest/image_vision`, () =>
    HttpResponse.json({ success: true, workout: SAMPLE_WORKOUT }),
  ),
  http.post(`${INGESTOR}/ingest/url`, () =>
    HttpResponse.json({ success: true, workout: SAMPLE_WORKOUT }),
  ),
  http.post(`${INGESTOR}/ingest/url/async`, () =>
    HttpResponse.json({ job_id: 'async-001', status: 'queued' }),
  ),
  http.post(`${INGESTOR}/ingest/instagram_test`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${INGESTOR}/ingest/instagram_reel`, () =>
    HttpResponse.json({ success: true, workout: SAMPLE_WORKOUT }),
  ),
  http.post(`${INGESTOR}/ingest/youtube`, () =>
    HttpResponse.json({ success: true, workout: SAMPLE_WORKOUT }),
  ),
  http.post(`${INGESTOR}/ingest/tiktok`, () =>
    HttpResponse.json({ success: true, workout: SAMPLE_WORKOUT }),
  ),
  http.post(`${INGESTOR}/ingest/pinterest`, () =>
    HttpResponse.json({ success: true, workout: SAMPLE_WORKOUT }),
  ),
  http.post(`${INGESTOR}/ingest/social-video`, () =>
    HttpResponse.json({ success: true, workout: SAMPLE_WORKOUT }),
  ),
  http.post(`${INGESTOR}/ingest/video`, () =>
    HttpResponse.json({ success: true, workout: SAMPLE_WORKOUT }),
  ),

  // --- Video ---
  http.post(`${INGESTOR}/video/detect`, () =>
    HttpResponse.json({ urls: [], platform: null }),
  ),
  http.get(`${INGESTOR}/video/oembed`, () =>
    HttpResponse.json({ title: 'Test Video', thumbnail_url: null }),
  ),
  http.post(`${INGESTOR}/video/oembed`, () =>
    HttpResponse.json({ title: 'Test Video', thumbnail_url: null }),
  ),
  http.post(`${INGESTOR}/video/cache/check`, () =>
    HttpResponse.json({ cached: false }),
  ),
  http.post(`${INGESTOR}/video/cache/save`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${INGESTOR}/video/cache/stats`, () =>
    HttpResponse.json({ total: 0, hit_rate: 0 }),
  ),
  http.get(`${INGESTOR}/video/cache/:platform/:videoId`, () =>
    HttpResponse.json(null),
  ),

  // --- Voice ---
  http.post(`${INGESTOR}/voice/transcribe`, () =>
    HttpResponse.json({ text: 'test transcription', confidence: 0.95 }),
  ),
  http.post(`${INGESTOR}/workouts/parse-voice`, () =>
    HttpResponse.json({ success: true, workout: SAMPLE_WORKOUT }),
  ),
  http.get(`${INGESTOR}/voice/settings`, () =>
    HttpResponse.json({ language: 'en', model: 'whisper-1' }),
  ),
  http.put(`${INGESTOR}/voice/settings`, () =>
    HttpResponse.json({ language: 'en', model: 'whisper-1' }),
  ),
  http.get(`${INGESTOR}/voice/dictionary`, () =>
    HttpResponse.json([]),
  ),
  http.post(`${INGESTOR}/voice/dictionary`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.delete(`${INGESTOR}/voice/dictionary`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${INGESTOR}/voice/fitness-vocab`, () =>
    HttpResponse.json([]),
  ),

  // --- Parse ---
  http.post(`${INGESTOR}/parse/text`, () =>
    HttpResponse.json({ workout: SAMPLE_WORKOUT }),
  ),

  // --- Workout operations & mixer ---
  http.post(`${INGESTOR}/workouts/:workoutId/operations`, () =>
    HttpResponse.json({ success: true, workout: SAMPLE_WORKOUT }),
  ),
  http.post(`${INGESTOR}/workouts/mix`, async ({ request }) => {
    // Check auth header — return 401 if missing
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey) {
      return HttpResponse.json({ detail: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json() as { title?: string; sources?: Array<{ workout_id: string; block_indices: number[] }> };
    const title = body.title || 'Mixed Workout';
    const sources = body.sources || [];

    // Check for non-existent workout IDs
    const knownWorkouts = KNOWN_WORKOUT_IDS;
    for (const source of sources) {
      if (!knownWorkouts.includes(source.workout_id)) {
        return HttpResponse.json({ detail: 'Workout not found' }, { status: 404 });
      }
      // Check for out-of-range block indices (each workout has 3 blocks)
      for (const idx of source.block_indices || []) {
        if (idx > 2) {
          return HttpResponse.json({ detail: 'Block index out of range' }, { status: 422 });
        }
      }
    }

    // Build blocks matching the requested block_indices from each source
    const blocks = sources.flatMap((source) =>
      (source.block_indices || []).map((idx) => ({
        label: `Block ${idx + 1} from ${source.workout_id.slice(0, 8)}`,
        structure: 'straight',
        exercises: [
          { name: 'Squat', sets: 3, reps: 10 },
        ],
      }))
    );

    return HttpResponse.json({
      preview: {
        title,
        workout: {
          blocks,
          metadata: { mixer_sources: sources.map((s) => s.workout_id) },
        },
      },
    });
  }),
  http.post(`${INGESTOR}/workouts/create-empty`, () =>
    HttpResponse.json(SAMPLE_WORKOUT),
  ),
  http.get(`${INGESTOR}/exercises/wger`, () =>
    HttpResponse.json([]),
  ),

  // --- Import workflow ---
  http.post(`${INGESTOR}/import/detect`, () =>
    HttpResponse.json({ format: 'text', confidence: 0.9 }),
  ),
  http.post(`${INGESTOR}/import/detect/file`, () =>
    HttpResponse.json({ format: 'csv', confidence: 0.95 }),
  ),
  http.post(`${INGESTOR}/import/detect/urls`, () =>
    HttpResponse.json({ urls: [], detected: [] }),
  ),
  http.post(`${INGESTOR}/import/detect/images`, () =>
    HttpResponse.json({ images: [], detected: [] }),
  ),
  http.post(`${INGESTOR}/import/map`, () =>
    HttpResponse.json({ mappings: [] }),
  ),
  http.post(`${INGESTOR}/import/match`, () =>
    HttpResponse.json({ matches: [] }),
  ),
  http.post(`${INGESTOR}/import/preview`, () =>
    HttpResponse.json({ workouts: [SAMPLE_WORKOUT], total: 1 }),
  ),
  http.post(`${INGESTOR}/import/execute`, () =>
    HttpResponse.json({ success: true, imported: 1 }),
  ),
  http.get(`${INGESTOR}/import/status/:jobId`, () =>
    HttpResponse.json({ status: 'completed', imported: 1 }),
  ),
  http.post(`${INGESTOR}/import/cancel/:jobId`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${INGESTOR}/import/exercises/search`, () =>
    HttpResponse.json([]),
  ),
  http.post(`${INGESTOR}/import/preview/operations`, () =>
    HttpResponse.json({ workouts: [SAMPLE_WORKOUT] }),
  ),

  // --- Export ---
  http.post(`${INGESTOR}/export/fit`, () =>
    new HttpResponse(new ArrayBuffer(100), {
      headers: { 'Content-Type': 'application/octet-stream' },
    }),
  ),
  http.post(`${INGESTOR}/export/csv`, () =>
    new HttpResponse('exercise,sets,reps\nSquat,3,10', {
      headers: { 'Content-Type': 'text/csv' },
    }),
  ),
  http.post(`${INGESTOR}/export/csv/bulk`, () =>
    new HttpResponse('exercise,sets,reps\nSquat,3,10', {
      headers: { 'Content-Type': 'text/csv' },
    }),
  ),
  http.post(`${INGESTOR}/export/json`, () =>
    HttpResponse.json({ workouts: [SAMPLE_WORKOUT] }),
  ),
  http.post(`${INGESTOR}/export/json/bulk`, () =>
    HttpResponse.json({ workouts: [SAMPLE_WORKOUT] }),
  ),
  http.post(`${INGESTOR}/export/pdf`, () =>
    new HttpResponse(new ArrayBuffer(100), {
      headers: { 'Content-Type': 'application/pdf' },
    }),
  ),
  http.post(`${INGESTOR}/export/tcx`, () =>
    new HttpResponse('<TrainingCenterDatabase/>', {
      headers: { 'Content-Type': 'application/xml' },
    }),
  ),
  http.post(`${INGESTOR}/export/tp_text`, () =>
    new HttpResponse('Workout: Test', {
      headers: { 'Content-Type': 'text/plain' },
    }),
  ),
  http.post(`${INGESTOR}/export/bulk/zip`, () =>
    new HttpResponse(new ArrayBuffer(100), {
      headers: { 'Content-Type': 'application/zip' },
    }),
  ),

  // --- Cache stats ---
  http.get(`${INGESTOR}/youtube/cache/stats`, () =>
    HttpResponse.json({ total: 0, hit_rate: 0 }),
  ),
  http.get(`${INGESTOR}/youtube/cache/:videoId`, () =>
    HttpResponse.json(null),
  ),
  http.get(`${INGESTOR}/tiktok/cache/stats`, () =>
    HttpResponse.json({ total: 0, hit_rate: 0 }),
  ),
  http.get(`${INGESTOR}/tiktok/cache/:videoId`, () =>
    HttpResponse.json(null),
  ),
  http.get(`${INGESTOR}/tiktok/metadata`, () =>
    HttpResponse.json({}),
  ),
  http.get(`${INGESTOR}/pinterest/metadata`, () =>
    HttpResponse.json({}),
  ),

  // --- Knowledge ---
  http.get(`${INGESTOR}/knowledge/search`, () =>
    HttpResponse.json([]),
  ),
  http.get(`${INGESTOR}/knowledge/for-exercise/:exercise`, () =>
    HttpResponse.json([]),
  ),

  // --- Notion integration ---
  http.post(`${INGESTOR}/integrations/notion/initiate`, () =>
    HttpResponse.json({ url: 'https://api.notion.com/v1/oauth/authorize?...' }),
  ),
  http.get(`${INGESTOR}/integrations/notion/callback`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.delete(`${INGESTOR}/integrations/notion/disconnect`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${INGESTOR}/integrations/notion/databases`, () =>
    HttpResponse.json([]),
  ),
  http.post(`${INGESTOR}/integrations/notion/import`, () =>
    HttpResponse.json({ success: true, imported: 0 }),
  ),
];

// ---------------------------------------------------------------------------
// CHAT-API handlers (port 8005)
// ---------------------------------------------------------------------------

const chatHandlers = [
  // Health
  http.get(`${CHAT}/health`, () =>
    HttpResponse.json({ status: 'ok' }),
  ),
  http.get(`${CHAT}/health/ready`, () =>
    HttpResponse.json({ status: 'ready' }),
  ),
  http.get(`${CHAT}/metrics`, () =>
    new HttpResponse('# HELP requests_total Total requests\nrequests_total 42', {
      headers: { 'Content-Type': 'text/plain' },
    }),
  ),

  // --- Chat ---
  http.post(`${CHAT}/chat/stream`, () =>
    new HttpResponse(
      'data: {"type":"message_start"}\n\ndata: {"type":"text","content":"Hello"}\n\ndata: {"type":"message_end"}\n\n',
      { headers: { 'Content-Type': 'text/event-stream' } },
    ),
  ),
  http.get(`${CHAT}/chat/sessions`, () =>
    HttpResponse.json([SAMPLE_CHAT_SESSION]),
  ),
  http.get(`${CHAT}/chat/sessions/:sessionId/messages`, () =>
    HttpResponse.json([SAMPLE_CHAT_MESSAGE]),
  ),
  http.delete(`${CHAT}/chat/sessions/:sessionId`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${CHAT}/chat/settings`, () =>
    HttpResponse.json({ voice_enabled: false, model: 'sonnet', system_prompt: null }),
  ),
  http.put(`${CHAT}/chat/settings`, () =>
    HttpResponse.json({ voice_enabled: false, model: 'sonnet', system_prompt: null }),
  ),
  http.post(`${CHAT}/chat/parse-workout`, () =>
    HttpResponse.json({ workout: SAMPLE_WORKOUT }),
  ),

  // --- Coach ---
  http.post(`${CHAT}/coach/message`, () =>
    HttpResponse.json({ response: 'Great question! Here is my advice.' }),
  ),
  http.post(`${CHAT}/coach/message/stream`, () =>
    new HttpResponse('data: {"type":"text","content":"Let me help you."}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    }),
  ),
  http.get(`${CHAT}/coach/usage`, () =>
    HttpResponse.json({ messages_today: 5, daily_limit: 50, tier: 'pro' }),
  ),
  http.get(`${CHAT}/coach/memories`, () =>
    HttpResponse.json([SAMPLE_COACH_MEMORY]),
  ),
  http.delete(`${CHAT}/coach/memories/:memoryId`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${CHAT}/coach/memories/consolidate`, () =>
    HttpResponse.json({ success: true, consolidated: 3 }),
  ),
  http.get(`${CHAT}/coach/profile`, () =>
    HttpResponse.json({ fitness_level: 'intermediate', goals: ['strength'], preferred_splits: ['ppl'] }),
  ),
  http.put(`${CHAT}/coach/profile`, () =>
    HttpResponse.json({ fitness_level: 'intermediate', goals: ['strength'] }),
  ),
  http.post(`${CHAT}/coach/fatigue-advice`, () =>
    HttpResponse.json({ advice: 'Consider a deload week.', fatigue_score: 7 }),
  ),
  http.post(`${CHAT}/coach/rpe-feedback`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${CHAT}/coach/rpe-history`, () =>
    HttpResponse.json([]),
  ),
  http.post(`${CHAT}/coach/suggest-workout`, () =>
    HttpResponse.json({ workout: SAMPLE_WORKOUT }),
  ),
  http.post(`${CHAT}/coach/async-tasks`, () =>
    HttpResponse.json({ task_id: 'task-001', status: 'queued' }),
  ),

  // --- Workout detection ---
  http.post(`${CHAT}/api/workouts/detect`, () =>
    HttpResponse.json({ is_workout: true, confidence: 0.95, type: 'strength' }),
  ),

  // --- Streaming workouts/programs ---
  http.post(`${CHAT}/api/workouts/generate/stream`, () =>
    new HttpResponse('data: {"type":"workout","content":{}}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    }),
  ),
  http.post(`${CHAT}/api/workouts/import/stream`, () =>
    new HttpResponse('data: {"type":"progress","step":"parsing"}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    }),
  ),
  http.post(`${CHAT}/api/workouts/save/stream`, () =>
    new HttpResponse('data: {"type":"saved","workout_id":"workout-001"}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    }),
  ),
  http.post(`${CHAT}/api/workouts/bulk-import/stream`, () =>
    new HttpResponse('data: {"type":"progress","imported":0}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    }),
  ),
  http.post(`${CHAT}/api/programs/design/stream`, () =>
    new HttpResponse('data: {"type":"design","content":{}}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    }),
  ),
  http.post(`${CHAT}/api/programs/generate/stream`, () =>
    new HttpResponse('data: {"type":"program","content":{}}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    }),
  ),
  http.post(`${CHAT}/api/programs/save/stream`, () =>
    new HttpResponse('data: {"type":"saved","program_id":"prog-001"}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    }),
  ),
  http.post(`${CHAT}/api/programs/replan/stream`, () =>
    new HttpResponse('data: {"type":"replan","content":{}}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    }),
  ),

  // --- Pipelines ---
  http.get(`${CHAT}/api/pipelines/:runId/status`, () =>
    HttpResponse.json({ status: 'completed', result: {} }),
  ),
  http.get(`${CHAT}/api/pipelines/:runId/resume`, () =>
    HttpResponse.json({ success: true }),
  ),

  // --- Embeddings (internal) ---
  http.post(`${CHAT}/internal/embeddings/generate`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${CHAT}/internal/embeddings/progress/:table`, () =>
    HttpResponse.json({ total: 100, embedded: 100, progress: 1.0 }),
  ),
  http.post(`${CHAT}/internal/embeddings/webhook`, () =>
    HttpResponse.json({ success: true }),
  ),

  // --- Gamification ---
  http.get(`${CHAT}/gamification/streak`, () =>
    HttpResponse.json({ current: 5, longest: 12, target: 7 }),
  ),
  http.put(`${CHAT}/gamification/streak/target`, () =>
    HttpResponse.json({ target: 7 }),
  ),
  http.post(`${CHAT}/gamification/streak/evaluate`, () =>
    HttpResponse.json({ streak_maintained: true, current: 5 }),
  ),
  http.get(`${CHAT}/gamification/badges`, () =>
    HttpResponse.json([SAMPLE_BADGE]),
  ),
  http.get(`${CHAT}/gamification/badges/recent`, () =>
    HttpResponse.json([SAMPLE_BADGE]),
  ),
  http.post(`${CHAT}/gamification/badges/check`, () =>
    HttpResponse.json({ new_badges: [] }),
  ),
  http.get(`${CHAT}/gamification/xp`, () =>
    HttpResponse.json({ total: 1500, level: 5, next_level_xp: 2000 }),
  ),
  http.post(`${CHAT}/gamification/xp/award`, () =>
    HttpResponse.json({ awarded: 50, new_total: 1550 }),
  ),
  http.post(`${CHAT}/gamification/rest-day`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${CHAT}/gamification/weekly-progress`, () =>
    HttpResponse.json({ workouts: 3, target: 4, completion_pct: 75 }),
  ),

  // --- Knowledge base ---
  http.post(`${CHAT}/api/knowledge/ingest`, () =>
    HttpResponse.json({ success: true, card: SAMPLE_KNOWLEDGE_CARD }),
  ),
  http.get(`${CHAT}/api/knowledge/cards`, () =>
    HttpResponse.json([SAMPLE_KNOWLEDGE_CARD]),
  ),
  http.get(`${CHAT}/api/knowledge/cards/:cardId`, () =>
    HttpResponse.json(SAMPLE_KNOWLEDGE_CARD),
  ),
  http.delete(`${CHAT}/api/knowledge/cards/:cardId`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${CHAT}/api/knowledge/search`, () =>
    HttpResponse.json([SAMPLE_KNOWLEDGE_CARD]),
  ),
  http.get(`${CHAT}/api/knowledge/tags`, () =>
    HttpResponse.json(['training', 'nutrition', 'recovery']),
  ),

  // --- Nutrition ---
  http.get(`${CHAT}/nutrition/fueling-status`, () =>
    HttpResponse.json({ status: 'fueled', last_meal: '2025-01-15T08:00:00Z' }),
  ),
  http.post(`${CHAT}/nutrition/protein-nudge/check`, () =>
    HttpResponse.json({ nudge: false, protein_today: 120, target: 150 }),
  ),
  http.post(`${CHAT}/nutrition/analyze-photo`, () =>
    HttpResponse.json({ foods: [], total_calories: 0, total_protein: 0 }),
  ),
  http.get(`${CHAT}/nutrition/barcode/:code`, () =>
    HttpResponse.json({ name: 'Unknown', calories: 0 }),
  ),
  http.post(`${CHAT}/nutrition/parse-text`, () =>
    HttpResponse.json({ foods: [], total_calories: 0 }),
  ),

  // --- Voice (TTS) ---
  http.post(`${CHAT}/voice/synthesize`, () =>
    new HttpResponse(new ArrayBuffer(100), {
      headers: { 'Content-Type': 'audio/mpeg' },
    }),
  ),
  http.post(`${CHAT}/voice/synthesize/json`, () =>
    new HttpResponse(new ArrayBuffer(100), {
      headers: { 'Content-Type': 'audio/mpeg' },
    }),
  ),
  http.get(`${CHAT}/voice/voices`, () =>
    HttpResponse.json([{ id: 'voice-001', name: 'Default', language: 'en' }]),
  ),
  http.get(`${CHAT}/voice/tts-settings`, () =>
    HttpResponse.json({ voice_id: 'voice-001', speed: 1.0 }),
  ),
  http.patch(`${CHAT}/voice/tts-settings`, () =>
    HttpResponse.json({ voice_id: 'voice-001', speed: 1.0 }),
  ),
  http.get(`${CHAT}/voice/usage`, () =>
    HttpResponse.json({ characters_used: 500, limit: 10000 }),
  ),

  // --- Settings ---
  http.post(`${CHAT}/settings/api-key`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${CHAT}/settings/api-key/status`, () =>
    HttpResponse.json({ configured: false }),
  ),
  http.delete(`${CHAT}/settings/api-key`, () =>
    HttpResponse.json({ success: true }),
  ),

  // --- Admin ---
  http.get(`${CHAT}/admin/costs`, () =>
    HttpResponse.json({ total: 0, breakdown: {} }),
  ),

  // --- Social ---
  http.post(`${CHAT}/social/follow/:userId`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.delete(`${CHAT}/social/follow/:userId`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${CHAT}/social/followers`, () =>
    HttpResponse.json([]),
  ),
  http.get(`${CHAT}/social/following`, () =>
    HttpResponse.json([]),
  ),
  http.post(`${CHAT}/social/block/:userId`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${CHAT}/social/report`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${CHAT}/social/settings`, () =>
    HttpResponse.json({ profile_visible: true, share_workouts: true }),
  ),
  http.put(`${CHAT}/social/settings`, () =>
    HttpResponse.json({ profile_visible: true, share_workouts: true }),
  ),
  http.get(`${CHAT}/social/feed`, () =>
    HttpResponse.json([SAMPLE_SOCIAL_POST]),
  ),
  http.post(`${CHAT}/social/posts`, () =>
    HttpResponse.json(SAMPLE_SOCIAL_POST),
  ),
  http.post(`${CHAT}/social/posts/:postId/react`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.delete(`${CHAT}/social/posts/:postId/react/:emoji`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${CHAT}/social/posts/:postId/comment`, () =>
    HttpResponse.json({ id: 'comment-001', content: 'Nice!', created_at: '2025-01-15T10:00:00Z' }),
  ),
  http.get(`${CHAT}/social/posts/:postId/comments`, () =>
    HttpResponse.json([]),
  ),

  // --- Social challenges ---
  http.post(`${CHAT}/social/challenges`, () =>
    HttpResponse.json(SAMPLE_CHALLENGE),
  ),
  http.get(`${CHAT}/social/challenges`, () =>
    HttpResponse.json([SAMPLE_CHALLENGE]),
  ),
  http.get(`${CHAT}/social/challenges/:challengeId`, () =>
    HttpResponse.json(SAMPLE_CHALLENGE),
  ),
  http.post(`${CHAT}/social/challenges/:challengeId/join`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${CHAT}/social/challenges/:challengeId/leaderboard`, () =>
    HttpResponse.json([]),
  ),
  http.get(`${CHAT}/social/challenges/:challengeId/progress`, () =>
    HttpResponse.json({ progress: 0, target: 30 }),
  ),
  http.post(`${CHAT}/social/challenges/:challengeId/update-progress`, () =>
    HttpResponse.json({ success: true }),
  ),

  // --- Social crews ---
  http.post(`${CHAT}/social/crews`, () =>
    HttpResponse.json(SAMPLE_CREW),
  ),
  http.get(`${CHAT}/social/crews`, () =>
    HttpResponse.json([SAMPLE_CREW]),
  ),
  http.get(`${CHAT}/social/crews/:crewId`, () =>
    HttpResponse.json(SAMPLE_CREW),
  ),
  http.post(`${CHAT}/social/crews/:crewId/join`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.delete(`${CHAT}/social/crews/:crewId/leave`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${CHAT}/social/crews/:crewId/feed`, () =>
    HttpResponse.json([]),
  ),
  http.post(`${CHAT}/social/crews/:crewId/challenge`, () =>
    HttpResponse.json(SAMPLE_CHALLENGE),
  ),
  http.delete(`${CHAT}/social/crews/:crewId/members/:userId`, () =>
    HttpResponse.json({ success: true }),
  ),

  // --- Social leaderboards ---
  http.get(`${CHAT}/social/leaderboards/friends`, () =>
    HttpResponse.json([]),
  ),
  http.get(`${CHAT}/social/leaderboards/crew/:crewId`, () =>
    HttpResponse.json([]),
  ),

  // --- Social notifications ---
  http.post(`${CHAT}/social/notifications/trigger`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${CHAT}/social/notifications/flush`, () =>
    HttpResponse.json({ flushed: 0 }),
  ),
  http.get(`${CHAT}/social/notifications/preferences`, () =>
    HttpResponse.json({ push: true, email: false }),
  ),
  http.put(`${CHAT}/social/notifications/preferences`, () =>
    HttpResponse.json({ push: true, email: false }),
  ),
  http.get(`${CHAT}/social/notifications`, () =>
    HttpResponse.json([]),
  ),
];

// ---------------------------------------------------------------------------
// CALENDAR-API handlers (port 8003)
// ---------------------------------------------------------------------------

const calendarHandlers = [
  // Health
  http.get(`${CALENDAR}/health`, () =>
    HttpResponse.json({ status: 'ok' }),
  ),

  // --- Calendar events ---
  http.get(`${CALENDAR}/calendar`, () =>
    HttpResponse.json([SAMPLE_CALENDAR_EVENT]),
  ),
  http.post(`${CALENDAR}/calendar`, () =>
    HttpResponse.json(SAMPLE_CALENDAR_EVENT),
  ),
  http.get(`${CALENDAR}/calendar/connected-calendars`, () =>
    HttpResponse.json([]),
  ),
  http.post(`${CALENDAR}/calendar/connected-calendars`, () =>
    HttpResponse.json({ id: 'cal-001', name: 'Google Calendar', provider: 'google' }),
  ),
  http.delete(`${CALENDAR}/calendar/connected-calendars/:calendarId`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${CALENDAR}/calendar/connected-calendars/:calendarId/sync`, () =>
    HttpResponse.json({ success: true, synced: 5 }),
  ),
  http.get(`${CALENDAR}/calendar/:eventId`, () =>
    HttpResponse.json(SAMPLE_CALENDAR_EVENT),
  ),
  http.put(`${CALENDAR}/calendar/:eventId`, () =>
    HttpResponse.json(SAMPLE_CALENDAR_EVENT),
  ),
  http.patch(`${CALENDAR}/calendar/:eventId`, () =>
    HttpResponse.json(SAMPLE_CALENDAR_EVENT),
  ),
  http.delete(`${CALENDAR}/calendar/:eventId`, () =>
    HttpResponse.json({ success: true }),
  ),

  // --- Calendar events (alternate path used by frontend) ---
  http.get(`${CALENDAR}/events`, () =>
    HttpResponse.json([SAMPLE_CALENDAR_EVENT]),
  ),
  http.post(`${CALENDAR}/events`, () =>
    HttpResponse.json(SAMPLE_CALENDAR_EVENT),
  ),
  http.get(`${CALENDAR}/events/:eventId`, () =>
    HttpResponse.json(SAMPLE_CALENDAR_EVENT),
  ),
  http.patch(`${CALENDAR}/events/:eventId`, () =>
    HttpResponse.json(SAMPLE_CALENDAR_EVENT),
  ),
  http.delete(`${CALENDAR}/events/:eventId`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${CALENDAR}/calendars`, () =>
    HttpResponse.json([]),
  ),
  http.post(`${CALENDAR}/calendars`, () =>
    HttpResponse.json({ id: 'cal-001', name: 'Google Calendar', provider: 'google' }),
  ),
  http.delete(`${CALENDAR}/calendars/:calendarId`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${CALENDAR}/calendars/:calendarId/sync`, () =>
    HttpResponse.json({ success: true, synced: 5 }),
  ),

  // --- Google Calendar OAuth ---
  http.post(`${CALENDAR}/calendar/oauth/google/initiate`, () =>
    HttpResponse.json({ url: 'https://accounts.google.com/o/oauth2/v2/auth?...' }),
  ),
  http.get(`${CALENDAR}/calendar/oauth/google/callback`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${CALENDAR}/calendar/oauth/google/events`, () =>
    HttpResponse.json([]),
  ),
  http.delete(`${CALENDAR}/calendar/oauth/google/disconnect`, () =>
    HttpResponse.json({ success: true }),
  ),

  // --- Planning (DayState & sessions) ---
  http.get(`${CALENDAR}/planning/days`, () =>
    HttpResponse.json([SAMPLE_DAY_STATE]),
  ),
  http.patch(`${CALENDAR}/planning/days/:targetDate`, () =>
    HttpResponse.json(SAMPLE_DAY_STATE),
  ),
  http.post(`${CALENDAR}/planning/sessions`, () =>
    HttpResponse.json({ id: 'session-001', date: '2025-01-15', workout_id: 'workout-001' }),
  ),
  http.delete(`${CALENDAR}/planning/sessions/:sessionId`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${CALENDAR}/planning/sessions/:sessionId/move`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${CALENDAR}/planning/generate`, () =>
    HttpResponse.json({ plan: [], days: 7 }),
  ),
  http.post(`${CALENDAR}/planning/generate-week`, () =>
    HttpResponse.json({ plan: [], days: 7 }),
  ),
  http.post(`${CALENDAR}/planning/rebalance`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${CALENDAR}/planning/detect-conflicts`, () =>
    HttpResponse.json({ conflicts: [] }),
  ),
  http.post(`${CALENDAR}/planning/parse-workout`, () =>
    HttpResponse.json({ workout: SAMPLE_WORKOUT }),
  ),
  http.post(`${CALENDAR}/planning/explain-session/:sessionId`, () =>
    HttpResponse.json({ explanation: 'This session targets upper body.' }),
  ),

  // --- Planning adapters ---
  http.get(`${CALENDAR}/planning/adapters`, () =>
    HttpResponse.json([]),
  ),
  http.post(`${CALENDAR}/planning/adapters/sync/:source`, () =>
    HttpResponse.json({ success: true, synced: 0 }),
  ),
  http.post(`${CALENDAR}/planning/adapters/sync-all`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${CALENDAR}/planning/adapters/sync/:source/preview`, () =>
    HttpResponse.json({ changes: [] }),
  ),

  // --- Pending actions ---
  http.get(`${CALENDAR}/actions`, () =>
    HttpResponse.json([SAMPLE_PENDING_ACTION]),
  ),
  http.post(`${CALENDAR}/actions`, () =>
    HttpResponse.json(SAMPLE_PENDING_ACTION),
  ),
  http.post(`${CALENDAR}/actions/:actionId/approve`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${CALENDAR}/actions/:actionId/reject`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${CALENDAR}/actions/:actionId/undo`, () =>
    HttpResponse.json({ success: true }),
  ),

  // --- Analytics ---
  http.get(`${CALENDAR}/analytics/shoe-comparison`, () =>
    HttpResponse.json({ shoes: [] }),
  ),

  // --- Push notifications ---
  http.post(`${CALENDAR}/notifications/send`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${CALENDAR}/notifications/subscribe`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.delete(`${CALENDAR}/notifications/subscribe`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${CALENDAR}/notifications/preferences`, () =>
    HttpResponse.json({ push: true, workout_reminders: true }),
  ),
  http.patch(`${CALENDAR}/notifications/preferences`, () =>
    HttpResponse.json({ push: true, workout_reminders: true }),
  ),

  // --- Training programs ---
  http.get(`${CALENDAR}/training-programs`, () =>
    HttpResponse.json({
      success: true,
      programs: [
        {
          id: 'tp-001',
          user_id: 'user-001',
          name: 'Test Program',
          goal: 'strength',
          periodization_model: 'linear',
          duration_weeks: 8,
          sessions_per_week: 4,
          experience_level: 'intermediate',
          status: 'active',
          current_week: 1,
        },
      ],
      count: 1,
    }),
  ),
  http.get(`${CALENDAR}/training-programs/:id`, () =>
    HttpResponse.json({
      success: true,
      program: {
        id: 'tp-001',
        user_id: 'user-001',
        name: 'Test Program',
        goal: 'strength',
        periodization_model: 'linear',
        duration_weeks: 8,
        sessions_per_week: 4,
        experience_level: 'intermediate',
        status: 'active',
        current_week: 1,
        weeks: [
          {
            id: 'week-001',
            week_number: 1,
            workouts: [
              {
                id: 'tp-w-001',
                name: 'Upper Body A',
                workout_type: 'strength',
                day_of_week: 1,
                exercises: [
                  { name: 'Bench Press', sets: 4, reps: 8, rest_seconds: 90 },
                ],
              },
            ],
          },
        ],
      },
    }),
  ),
  http.patch(`${CALENDAR}/training-programs/:id/status`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.patch(`${CALENDAR}/training-programs/:id/progress`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.delete(`${CALENDAR}/training-programs/:id`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.patch(`${CALENDAR}/training-programs/workouts/:workoutId/complete`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${CALENDAR}/training-programs/workouts/:workoutId`, () =>
    HttpResponse.json({ workout: SAMPLE_WORKOUT }),
  ),

  // --- Program events ---
  http.post(`${CALENDAR}/program-events/bulk-create`, () =>
    HttpResponse.json({ success: true, created: 0 }),
  ),
  http.get(`${CALENDAR}/program-events/:programId`, () =>
    HttpResponse.json([]),
  ),
  http.delete(`${CALENDAR}/program-events/:programId`, () =>
    HttpResponse.json({ success: true }),
  ),

  // --- Smart planner ---
  http.post(`${CALENDAR}/planner/smart-plan`, () =>
    HttpResponse.json({ plan: [] }),
  ),
  http.post(`${CALENDAR}/planner/check-workout`, () =>
    HttpResponse.json({ suitable: true, notes: [] }),
  ),
  http.get(`${CALENDAR}/planner/rules`, () =>
    HttpResponse.json([]),
  ),
  http.put(`${CALENDAR}/planner/rules/:ruleId/toggle`, () =>
    HttpResponse.json({ success: true }),
  ),
];

// ---------------------------------------------------------------------------
// STRAVA-SYNC-API handlers (port 8000)
// ---------------------------------------------------------------------------

const stravaHandlers = [
  http.get(`${STRAVA}/health`, () =>
    HttpResponse.json({ status: 'ok' }),
  ),
  http.get(`${STRAVA}/strava/activities`, () =>
    HttpResponse.json([]),
  ),
  http.put(`${STRAVA}/strava/activities/:id`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${STRAVA}/strava/activities`, () =>
    HttpResponse.json({ id: 'activity-001' }),
  ),
  http.get(`${STRAVA}/strava/oauth/initiate`, () =>
    HttpResponse.json({ url: 'https://strava.com/oauth/authorize?...' }),
  ),
  http.post(`${STRAVA}/strava/oauth/initiate`, () =>
    HttpResponse.json({ url: 'https://strava.com/oauth/authorize?...' }),
  ),
  http.get(`${STRAVA}/strava/athlete`, () =>
    HttpResponse.json({ id: 12345, firstname: 'Test', lastname: 'User' }),
  ),
  http.post(`${STRAVA}/strava/token/refresh`, () =>
    HttpResponse.json({ success: true }),
  ),
];

// ---------------------------------------------------------------------------
// Combined export
// ---------------------------------------------------------------------------

export const handlers = [
  ...mapperHandlers,
  ...ingestorHandlers,
  ...chatHandlers,
  ...calendarHandlers,
  ...stravaHandlers,
];
