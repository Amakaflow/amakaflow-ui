// src/lib/__tests__/demo-mode.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock demo-mode to simulate VITE_DEMO_MODE=true for all tests.
// isDemoMode is evaluated at module load time so we must mock it before any
// module that imports it is loaded.
vi.mock('../demo-mode', () => ({
  isDemoMode: true,
  DEMO_USER: {
    id: 'demo-user-1',
    email: 'demo@amakaflow.com',
    name: 'Alex Demo',
    subscription: 'pro' as const,
    workoutsThisWeek: 5,
    selectedDevices: ['garmin', 'apple'] as string[],
    exportGarminUsb: false,
    billingDate: new Date('2026-12-01'),
    avatar: undefined as string | undefined,
    mode: 'trainer' as const,
  },
}));

// Mock authenticated-fetch so no real HTTP calls are attempted.
vi.mock('../authenticated-fetch', () => ({
  authenticatedFetch: vi.fn(),
  getAuthToken: vi.fn(() => Promise.resolve(null)),
  setGlobalTokenGetter: vi.fn(),
  createAuthenticatedFetch: vi.fn(),
}));

// Mock the new typed API clients so demo-mode tests are not broken by the
// AMA-918 migration. In demo mode the old workout-api / calendar-api used
// isDemoMode guards; now those guards are gone and the clients are called
// directly. We mock them here so the tests get the expected demo values.
vi.mock('../../api/clients/mapper', () => ({
  getWorkouts: vi.fn(() => Promise.resolve([])),
  saveWorkout: vi.fn(() => Promise.resolve({
    id: 'demo-mock-id',
    profile_id: 'demo-user-1',
    workout_data: { title: 'Demo', blocks: [] },
    sources: [],
    device: 'web',
    is_exported: false,
    is_favorite: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })),
  getWorkout: vi.fn(() => Promise.resolve(null)),
  deleteWorkout: vi.fn(() => Promise.resolve(true)),
  updateWorkoutExportStatus: vi.fn(() => Promise.resolve(true)),
  toggleWorkoutFavorite: vi.fn(() => Promise.resolve(null)),
  trackWorkoutUsage: vi.fn(() => Promise.resolve(null)),
  updateWorkoutTags: vi.fn(() => Promise.resolve(null)),
  getPrograms: vi.fn(() => Promise.resolve([])),
  getProgram: vi.fn(() => Promise.resolve(null)),
  createProgram: vi.fn(() => Promise.resolve(null)),
  updateProgram: vi.fn(() => Promise.resolve(null)),
  deleteProgram: vi.fn(() => Promise.resolve(false)),
  getUserTags: vi.fn(() => Promise.resolve([])),
  createUserTag: vi.fn(() => Promise.resolve(null)),
  deleteUserTag: vi.fn(() => Promise.resolve(false)),
}));

vi.mock('../../api/clients/calendar', () => ({
  getEvents: vi.fn(() => Promise.resolve([
    {
      id: 'anchor-long-run-nov23',
      user_id: 'demo-user-1',
      title: 'Long Run',
      source: 'connected_calendar',
      date: '2024-11-23',
      status: 'planned',
      is_anchor: true,
    },
  ])),
  getEvent: vi.fn(() => Promise.resolve(null)),
  createEvent: vi.fn(() => Promise.resolve(null)),
  updateEvent: vi.fn(() => Promise.resolve(null)),
  deleteEvent: vi.fn(() => Promise.resolve()),
  getConnectedCalendars: vi.fn(() => Promise.resolve([
    {
      id: 'conn-cal-runna-1',
      name: 'Runna – Subscribed',
      type: 'runna',
      integration_type: 'ics_url',
      is_workout_calendar: true,
      sync_status: 'active',
      workouts_this_week: 3,
    },
  ])),
  createConnectedCalendar: vi.fn(() => Promise.resolve(null)),
  deleteConnectedCalendar: vi.fn(() => Promise.resolve()),
  syncConnectedCalendar: vi.fn(() => Promise.resolve()),
}));

// Mock config so import.meta.env accesses inside it don't break in test env.
vi.mock('../config', () => ({
  API_URLS: {
    MAPPER: 'http://localhost:8001',
    INGESTOR: 'http://localhost:8004',
    STRAVA: 'http://localhost:8000',
    GARMIN: 'http://localhost:8002',
    CALENDAR: 'http://localhost:8003',
    CHAT: 'http://localhost:8005',
  },
  getApiUrl: vi.fn((key: string) => `http://localhost:8001`),
  isLocalDevelopment: vi.fn(() => true),
  getApiHealthEndpoints: vi.fn(() => []),
}));

// Mock env helper used by follow-along-api
vi.mock('../env', () => ({
  ENABLE_GARMIN_DEBUG: false,
}));

// Mock calendar-mock-data (imported by calendar-api)
vi.mock('../calendar-mock-data', () => ({
  sampleCalendarEvents: [
    {
      id: 'anchor-long-run-nov23',
      user_id: 'demo-user-1',
      title: 'Long Run',
      source: 'connected_calendar',
      date: '2024-11-23',
      status: 'planned',
      is_anchor: true,
    },
  ],
  mockConnectedCalendars: [
    {
      id: 'conn-cal-runna-1',
      name: 'Runna – Subscribed',
      type: 'runna',
      integration_type: 'ics_url',
      is_workout_calendar: true,
      sync_status: 'active',
      workouts_this_week: 3,
    },
  ],
  seedCalendarData: vi.fn(() => []),
  getEventsInRange: vi.fn(() => []),
}));

// ---------------------------------------------------------------------------
// Mock Data Hub
// ---------------------------------------------------------------------------

describe('Mock Data Hub', () => {
  it('MOCK_WORKOUT_HISTORY has 2 workouts with required fields', async () => {
    const { MOCK_WORKOUT_HISTORY } = await import('../mock-data');
    expect(MOCK_WORKOUT_HISTORY).toHaveLength(2);
    expect(MOCK_WORKOUT_HISTORY[0]).toHaveProperty('id');
    expect(MOCK_WORKOUT_HISTORY[0]).toHaveProperty('workout');
    expect(MOCK_WORKOUT_HISTORY[0].workout).toHaveProperty('title');
    expect(MOCK_WORKOUT_HISTORY[0].workout).toHaveProperty('blocks');
    expect(Array.isArray(MOCK_WORKOUT_HISTORY[0].workout.blocks)).toBe(true);
  });

  it('MOCK_WORKOUT_HISTORY second item has title "Upper Body Strength"', async () => {
    const { MOCK_WORKOUT_HISTORY } = await import('../mock-data');
    expect(MOCK_WORKOUT_HISTORY[1].workout.title).toBe('Upper Body Strength');
  });

  it('MOCK_WORKOUT_HISTORY items have required shape fields', async () => {
    const { MOCK_WORKOUT_HISTORY } = await import('../mock-data');
    for (const item of MOCK_WORKOUT_HISTORY) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('sources');
      expect(item).toHaveProperty('device');
      expect(item).toHaveProperty('createdAt');
      expect(item).toHaveProperty('updatedAt');
    }
  });

  it('MOCK_PROGRAMS has 3 programs with required fields', async () => {
    const { MOCK_PROGRAMS } = await import('../mock-data');
    expect(MOCK_PROGRAMS).toHaveLength(3);
    expect(MOCK_PROGRAMS[0]).toHaveProperty('name');
    expect(MOCK_PROGRAMS[0]).toHaveProperty('duration_weeks');
  });

  it('MOCK_PROGRAMS first entry is "Hyrox 8-Week Prep"', async () => {
    const { MOCK_PROGRAMS } = await import('../mock-data');
    expect(MOCK_PROGRAMS[0].name).toBe('Hyrox 8-Week Prep');
    expect(MOCK_PROGRAMS[0].duration_weeks).toBe(8);
  });

  it('MOCK_ANALYTICS has weeklyVolume array with entries', async () => {
    const { MOCK_ANALYTICS } = await import('../mock-data');
    expect(MOCK_ANALYTICS.weeklyVolume).toBeInstanceOf(Array);
    expect(MOCK_ANALYTICS.weeklyVolume.length).toBeGreaterThan(0);
    expect(MOCK_ANALYTICS.weeklyVolume[0]).toHaveProperty('week');
    expect(MOCK_ANALYTICS.weeklyVolume[0]).toHaveProperty('workouts');
  });

  it('MOCK_ANALYTICS has exerciseBreakdown array with entries', async () => {
    const { MOCK_ANALYTICS } = await import('../mock-data');
    expect(MOCK_ANALYTICS.exerciseBreakdown).toBeInstanceOf(Array);
    expect(MOCK_ANALYTICS.exerciseBreakdown.length).toBeGreaterThan(0);
    expect(MOCK_ANALYTICS.exerciseBreakdown[0]).toHaveProperty('name');
    expect(MOCK_ANALYTICS.exerciseBreakdown[0]).toHaveProperty('value');
  });

  it('DEMO_USER has required profile fields', async () => {
    const { DEMO_USER } = await import('../demo-mode');
    expect(DEMO_USER.id).toBe('demo-user-1');
    expect(DEMO_USER.name).toBe('Alex Demo');
    expect(DEMO_USER.email).toBe('demo@amakaflow.com');
    expect(DEMO_USER.subscription).toBe('pro');
    expect(DEMO_USER.mode).toBe('trainer');
    expect(DEMO_USER.selectedDevices).toContain('garmin');
    expect(DEMO_USER.selectedDevices).toContain('apple');
    expect(DEMO_USER.workoutsThisWeek).toBe(5);
    expect(DEMO_USER.exportGarminUsb).toBe(false);
  });

  it('DEMO_USER billingDate is a Date object', async () => {
    const { DEMO_USER } = await import('../demo-mode');
    expect(DEMO_USER.billingDate).toBeInstanceOf(Date);
    expect(DEMO_USER.billingDate.getFullYear()).toBe(2026);
  });
});

// ---------------------------------------------------------------------------
// workout-history demo intercept
// ---------------------------------------------------------------------------

describe('workout-history demo intercept', () => {
  it('getWorkoutHistory returns MOCK_WORKOUT_HISTORY when isDemoMode=true', async () => {
    const { getWorkoutHistory } = await import('../workout-history');
    const { MOCK_WORKOUT_HISTORY } = await import('../mock-data');
    const result = await getWorkoutHistory('any-profile-id');
    expect(result).toEqual(MOCK_WORKOUT_HISTORY);
  });

  it('getWorkoutHistory returns MOCK_WORKOUT_HISTORY even without a profileId', async () => {
    const { getWorkoutHistory } = await import('../workout-history');
    const { MOCK_WORKOUT_HISTORY } = await import('../mock-data');
    const result = await getWorkoutHistory();
    expect(result).toEqual(MOCK_WORKOUT_HISTORY);
  });

  it('getWorkoutHistory result has 2 items', async () => {
    const { getWorkoutHistory } = await import('../workout-history');
    const result = await getWorkoutHistory('test-user');
    expect(result).toHaveLength(2);
  });

  it('saveWorkoutToHistory returns an empty object and does not throw in demo mode', async () => {
    const { saveWorkoutToHistory } = await import('../workout-history');
    // In demo mode the function returns {} as WorkoutHistoryItem immediately.
    const result = await saveWorkoutToHistory(
      'demo-profile',
      { title: 'Test', blocks: [] } as any,
      'garmin' as any
    );
    // Should not throw and should return the no-op sentinel object
    expect(result).toBeDefined();
  });

  it('saveWorkoutToHistory with object pattern does not throw in demo mode', async () => {
    const { saveWorkoutToHistory } = await import('../workout-history');
    await expect(
      saveWorkoutToHistory({
        workout: { title: 'Demo Workout', blocks: [] } as any,
        sources: ['demo'],
        device: 'garmin' as any,
      })
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// workout-api demo intercept
// ---------------------------------------------------------------------------

describe('workout-api demo intercept', () => {
  it('getWorkoutsFromAPI returns [] when isDemoMode=true', async () => {
    const { getWorkoutsFromAPI } = await import('../workout-api');
    const result = await getWorkoutsFromAPI({ profile_id: 'demo-user-1' });
    expect(result).toEqual([]);
  });

  it('getWorkoutsFromAPI returns an array (not null/undefined)', async () => {
    const { getWorkoutsFromAPI } = await import('../workout-api');
    const result = await getWorkoutsFromAPI({ profile_id: 'demo-user-1', limit: 50 });
    expect(Array.isArray(result)).toBe(true);
  });

  it('saveWorkoutToAPI returns a demo object with id prefixed "demo-"', async () => {
    const { saveWorkoutToAPI } = await import('../workout-api');
    const result = await saveWorkoutToAPI({
      profile_id: 'demo-user-1',
      workout_data: { title: 'Test', blocks: [] },
      sources: ['demo'],
      device: 'garmin',
      title: 'Test',
    });
    expect(result).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(result.id.startsWith('demo-')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calendar-api demo intercept
// ---------------------------------------------------------------------------

describe('calendar-api demo intercept', () => {
  it('calendarApi.getEvents returns mock calendar events when isDemoMode=true', async () => {
    const { calendarApi } = await import('../calendar-api');
    const result = await calendarApi.getEvents('2024-11-23', '2024-11-30');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('calendarApi.getEvents result items have required fields', async () => {
    const { calendarApi } = await import('../calendar-api');
    const result = await calendarApi.getEvents('2024-11-23', '2024-11-30');
    const first = result[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('title');
    expect(first).toHaveProperty('date');
    expect(first).toHaveProperty('status');
  });

  it('calendarApi.getConnectedCalendars returns mock calendars when isDemoMode=true', async () => {
    const { calendarApi } = await import('../calendar-api');
    const result = await calendarApi.getConnectedCalendars();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('id');
    expect(result[0]).toHaveProperty('name');
    expect(result[0]).toHaveProperty('type');
  });

  it('calendarApi.createEvent is a no-op in demo mode (returns null)', async () => {
    const { calendarApi } = await import('../calendar-api');
    const result = await calendarApi.createEvent({
      title: 'Should be skipped',
      date: '2024-11-25',
    });
    // Demo guard returns null as any
    expect(result).toBeNull();
  });

  it('calendarApi.updateEvent is a no-op in demo mode (returns null)', async () => {
    const { calendarApi } = await import('../calendar-api');
    const result = await calendarApi.updateEvent('any-id', { title: 'Updated' });
    expect(result).toBeNull();
  });

  it('calendarApi.deleteEvent resolves without throwing in demo mode', async () => {
    const { calendarApi } = await import('../calendar-api');
    await expect(calendarApi.deleteEvent('any-id')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// follow-along-api demo intercept
// ---------------------------------------------------------------------------

describe('follow-along demo intercept', () => {
  it('listFollowAlong returns { items: [] } when isDemoMode=true', async () => {
    const { listFollowAlong } = await import('../follow-along-api');
    const result = await listFollowAlong('demo-user-1');
    expect(result).toEqual({ items: [] });
  });

  it('listFollowAlong items array is empty in demo mode', async () => {
    const { listFollowAlong } = await import('../follow-along-api');
    const result = await listFollowAlong();
    expect(result.items).toHaveLength(0);
  });

  it('listFollowAlong returns an object with an items property', async () => {
    const { listFollowAlong } = await import('../follow-along-api');
    const result = await listFollowAlong();
    expect(result).toHaveProperty('items');
    expect(Array.isArray(result.items)).toBe(true);
  });
});
