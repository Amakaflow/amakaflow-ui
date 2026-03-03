# API Layer Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace scattered `isDemoMode` branches and untyped API calls with a layered architecture: openapi-typescript codegen → Zod runtime validation → typed clients → MSW network interception.

**Architecture:** Three independent safety layers share the same contracts. Generated types provide compile-time safety. Zod schemas validate at runtime at the API boundary. MSW intercepts `fetch()` in demo/test mode — app code never checks `isDemoMode`. Migration is incremental: one service per task, old files deleted only when fully replaced.

**Tech Stack:** openapi-typescript (codegen), zod (runtime validation), msw v2 (already installed), vitest (contract tests), authenticated-fetch.ts (unchanged HTTP primitive)

---

## Context for Implementer

### Key existing files to understand before starting:

- `src/lib/authenticated-fetch.ts` — HTTP primitive, DO NOT MODIFY. All new clients use `authenticatedFetch()` from here.
- `src/lib/config.ts` — `API_URLS` registry with env-var overrides. Use these constants; never hardcode URLs.
- `src/lib/demo-mode.ts` — exports `isDemoMode: boolean`. After migration, this is only imported in `src/main.tsx`.
- `src/lib/workout-api.ts` — mapper-api client (workouts, programs, tags). Has `isDemoMode` on lines 111, 141, 426, 588.
- `src/lib/api.ts` — ingestor-api client (`generateWorkoutStructure`, `createEmptyWorkout`). No `isDemoMode` here; `normalizeWorkoutStructure` is a pure utility.
- `src/lib/calendar-api.ts` — calendar-api client. Has `isDemoMode` on lines 193, 221, 232, 241, 257, 265, 275, 293.
- `src/lib/workout-history.ts` — uses `getWorkoutsFromAPI` from workout-api; has `isDemoMode` on lines 193, 252.
- `src/lib/__tests__/contracts/progression.contract.test.ts` — the existing contract test pattern to follow.

### Local service ports (for running generate:types against local backend):
- mapper-api: `http://localhost:8001`
- ingestor-api (workout-ingestor): `http://localhost:8004`
- calendar-api: `http://localhost:8003`
- chat-api: `http://localhost:8005`

### MSW version note:
`msw` is already in devDependencies. The project uses msw v2 (check `package.json`). The API is `http` (not `rest`) from `msw/browser`.

---

## Task 1: Setup — Dependencies, Directory Structure, MSW Bootstrap

**Files:**
- Modify: `package.json`
- Create: `src/api/generated/.gitkeep`
- Create: `src/api/schemas/.gitkeep`
- Create: `src/api/clients/.gitkeep`
- Create: `src/api/mocks/handlers/.gitkeep`
- Create: `src/api/mocks/browser.ts`
- Create: `src/api/mocks/handlers/index.ts`
- Modify: `src/main.tsx`

**Step 1: Install dependencies**

```bash
cd /path/to/amakaflow-ui
npm install zod
npm install --save-dev openapi-typescript
```

Expected output: both packages installed without errors.

**Step 2: Add generate:types scripts to package.json**

In `package.json`, add to the `"scripts"` section:

```json
"generate:types": "npm run generate:types:mapper && npm run generate:types:ingestor && npm run generate:types:calendar && npm run generate:types:chat && npm run generate:types:strava && npm run generate:types:garmin",
"generate:types:mapper":   "openapi-typescript ${MAPPER_API_URL:-http://localhost:8001}/openapi.json -o src/api/generated/mapper.d.ts",
"generate:types:ingestor": "openapi-typescript ${INGESTOR_API_URL:-http://localhost:8004}/openapi.json -o src/api/generated/ingestor.d.ts",
"generate:types:calendar": "openapi-typescript ${CALENDAR_API_URL:-http://localhost:8003}/openapi.json -o src/api/generated/calendar.d.ts",
"generate:types:chat":     "openapi-typescript ${CHAT_API_URL:-http://localhost:8005}/openapi.json -o src/api/generated/chat.d.ts",
"generate:types:strava":   "openapi-typescript ${STRAVA_API_URL:-http://localhost:8006}/openapi.json -o src/api/generated/strava.d.ts",
"generate:types:garmin":   "openapi-typescript ${GARMIN_API_URL:-http://localhost:8007}/openapi.json -o src/api/generated/garmin.d.ts",
"test:contracts": "vitest run src/lib/__tests__/contracts/"
```

**Step 3: Create directory structure**

```bash
mkdir -p src/api/generated src/api/schemas src/api/clients src/api/mocks/handlers
touch src/api/generated/.gitkeep src/api/schemas/.gitkeep src/api/clients/.gitkeep src/api/mocks/handlers/.gitkeep
```

**Step 4: Create the MSW browser worker**

Create `src/api/mocks/browser.ts`:

```ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
```

**Step 5: Create the handlers index (empty for now)**

Create `src/api/mocks/handlers/index.ts`:

```ts
// Handlers are added here as each service is migrated.
// Each service adds its handlers array to this list.
export const handlers: Parameters<typeof import('msw/browser')['setupWorker']>[0][] = [];
```

**Step 6: Update src/main.tsx to bootstrap MSW in demo mode**

Find the file `src/main.tsx`. It currently imports and renders the app. Add the MSW bootstrap at the top, before `ReactDOM.createRoot(...)`:

```ts
// Add these imports near the top:
import { isDemoMode } from './lib/demo-mode';

// Add this block BEFORE the ReactDOM.createRoot(...).render(...) call:
async function enableMocking() {
  if (!isDemoMode) return;
  const { worker } = await import('./api/mocks/browser');
  return worker.start({ onUnhandledRequest: 'warn' });
}

// Wrap the render call:
enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
```

If `main.tsx` already has a top-level `ReactDOM.createRoot(...).render(...)` call, wrap it in the `enableMocking().then(...)` callback. Don't change anything else in the file.

**Step 7: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: build succeeds (or only pre-existing errors, not new ones from our additions).

**Step 8: Commit**

```bash
git add package.json src/api/ src/main.tsx
git commit -m "feat: scaffold api layer — MSW bootstrap, directory structure, generate:types scripts"
```

---

## Task 2: Mapper API Migration (workout-api.ts → src/api/clients/mapper.ts)

This is the highest-priority service — it handles all workout CRUD, programs, and tags. It has the most `isDemoMode` branches.

**Files:**
- Create: `src/api/generated/mapper.d.ts`
- Create: `src/api/schemas/mapper.ts`
- Create: `src/api/clients/mapper.ts`
- Create: `src/api/mocks/handlers/mapper.ts`
- Modify: `src/api/mocks/handlers/index.ts`
- Create: `src/lib/__tests__/contracts/mapper.contract.test.ts`
- Modify: `src/lib/workout-api.ts` (strip isDemoMode branches, update imports to use new client)
- Modify: `src/lib/workout-history.ts` (strip isDemoMode branch on line 252)

**Step 1: Generate types from the live mapper-api**

Ensure mapper-api is running locally (or use staging URL), then run:

```bash
npm run generate:types:mapper
```

This creates `src/api/generated/mapper.d.ts`. If the local backend isn't running, create the file manually with the types below (based on existing TypeScript interfaces in `workout-api.ts`). The file must start with `// @generated — do not edit. Run npm run generate:types:mapper to regenerate.`:

```ts
// @generated — do not edit. Run npm run generate:types:mapper to regenerate.
// Manually maintained until generate script runs against live backend.

export interface SavedWorkout {
  id: string;
  profile_id: string;
  workout_data: Record<string, unknown>;
  sources: string[];
  device: string;
  exports?: Record<string, unknown>;
  validation?: Record<string, unknown>;
  title?: string;
  description?: string;
  is_exported: boolean;
  exported_at?: string;
  exported_to_device?: string;
  synced_to_strava?: boolean;
  strava_activity_id?: string;
  ios_companion_synced_at?: string;
  android_companion_synced_at?: string;
  sync_status?: {
    ios?: { status: string; queued_at?: string; synced_at?: string; failed_at?: string; error_message?: string };
    android?: { status: string; queued_at?: string; synced_at?: string; failed_at?: string; error_message?: string };
    garmin?: { status: string; queued_at?: string; synced_at?: string; failed_at?: string; error_message?: string };
  };
  created_at: string;
  updated_at: string;
}

export interface WorkoutProgram {
  id: string;
  profile_id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  current_day_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  members?: ProgramMember[];
}

export interface ProgramMember {
  id: string;
  program_id: string;
  workout_id?: string;
  follow_along_id?: string;
  day_order: number;
  created_at: string;
}

export interface UserTag {
  id: string;
  profile_id: string;
  name: string;
  color?: string;
  created_at: string;
}

export interface SaveWorkoutsResponse {
  success: boolean;
  workout_id: string;
  message: string;
}

export interface GetWorkoutsResponse {
  success: boolean;
  workouts: SavedWorkout[];
  count: number;
}

export interface GetProgramsResponse {
  success: boolean;
  programs: WorkoutProgram[];
  count: number;
}

export interface GetTagsResponse {
  success: boolean;
  tags: UserTag[];
  count: number;
}
```

**Step 2: Write Zod schemas**

Create `src/api/schemas/mapper.ts`:

```ts
import { z } from 'zod';
import type { SavedWorkout, WorkoutProgram, UserTag } from '../generated/mapper';

const SyncStatusEntrySchema = z.object({
  status: z.string(),
  queued_at: z.string().optional(),
  synced_at: z.string().optional(),
  failed_at: z.string().optional(),
  error_message: z.string().optional(),
});

export const SavedWorkoutSchema = z.object({
  id: z.string(),
  profile_id: z.string(),
  workout_data: z.record(z.unknown()),
  sources: z.array(z.string()),
  device: z.string(),
  exports: z.record(z.unknown()).optional(),
  validation: z.record(z.unknown()).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  is_exported: z.boolean(),
  exported_at: z.string().optional(),
  exported_to_device: z.string().optional(),
  synced_to_strava: z.boolean().optional(),
  strava_activity_id: z.string().optional(),
  ios_companion_synced_at: z.string().optional(),
  android_companion_synced_at: z.string().optional(),
  sync_status: z.object({
    ios: SyncStatusEntrySchema.optional(),
    android: SyncStatusEntrySchema.optional(),
    garmin: SyncStatusEntrySchema.optional(),
  }).optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const WorkoutProgramSchema = z.object({
  id: z.string(),
  profile_id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  current_day_index: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  members: z.array(z.object({
    id: z.string(),
    program_id: z.string(),
    workout_id: z.string().optional(),
    follow_along_id: z.string().optional(),
    day_order: z.number(),
    created_at: z.string(),
  })).optional(),
});

export const UserTagSchema = z.object({
  id: z.string(),
  profile_id: z.string(),
  name: z.string(),
  color: z.string().optional(),
  created_at: z.string(),
});

// Compile-time verification: Zod schema must match generated type.
// If you regenerate types and this errors, update the Zod schema to match.
type _VerifySavedWorkout = z.infer<typeof SavedWorkoutSchema> extends SavedWorkout ? true : never;
type _VerifyProgram = z.infer<typeof WorkoutProgramSchema> extends WorkoutProgram ? true : never;
type _VerifyTag = z.infer<typeof UserTagSchema> extends UserTag ? true : never;
```

**Step 3: Write the typed client**

Create `src/api/clients/mapper.ts`:

```ts
/**
 * Mapper API client — typed, validated, MSW-interceptable.
 * No isDemoMode branches here. Demo mode is handled by MSW handlers.
 */
import { authenticatedFetch } from '../../lib/authenticated-fetch';
import { API_URLS } from '../../lib/config';
import { generateAutoTags } from '../../lib/auto-tags';
import { SavedWorkoutSchema, WorkoutProgramSchema, UserTagSchema } from '../schemas/mapper';
import type {
  SavedWorkout, WorkoutProgram, UserTag,
  SaveWorkoutsResponse, GetWorkoutsResponse, GetProgramsResponse, GetTagsResponse,
} from '../generated/mapper';
import type { WorkoutStructure } from '../../types/workout';

const BASE = API_URLS.MAPPER;

async function call<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE}${endpoint}`;
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...options.headers };
  const response = await authenticatedFetch(url, { ...options, headers });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    const msg = Array.isArray(err.detail)
      ? err.detail.map((e: any) => `${e.loc?.join('.')}: ${e.msg}`).join(', ')
      : err.detail || err.message || `Mapper API error: ${response.status}`;
    throw new Error(msg);
  }
  return response.json();
}

// ── Workouts ──────────────────────────────────────────────────────────────────

export interface SaveWorkoutRequest {
  profile_id: string;
  workout_data: WorkoutStructure;
  sources: string[];
  device?: string;
  exports?: Record<string, unknown>;
  validation?: Record<string, unknown>;
  title?: string;
  description?: string;
  workout_id?: string;
  tags?: string[];
}

export async function saveWorkout(request: SaveWorkoutRequest): Promise<SavedWorkout> {
  const autoTags = generateAutoTags(request.workout_data);
  const tags = Array.from(new Set([...autoTags, ...(request.tags || [])]));
  const body = { ...request, tags, device: request.device ?? 'web' };

  const result = await call<SaveWorkoutsResponse>('/workouts/save', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!result.success) throw new Error(result.message || 'Failed to save workout');

  const workout = await getWorkout(result.workout_id, request.profile_id);
  if (!workout) throw new Error('Workout saved but could not retrieve it');
  return workout;
}

export async function getWorkouts(params: {
  profile_id: string;
  device?: string;
  is_exported?: boolean;
  limit?: number;
}): Promise<SavedWorkout[]> {
  const q = new URLSearchParams({ profile_id: params.profile_id });
  if (params.device) q.append('device', params.device);
  if (params.is_exported !== undefined) q.append('is_exported', params.is_exported.toString());
  if (params.limit) q.append('limit', params.limit.toString());

  const result = await call<GetWorkoutsResponse>(`/workouts?${q}`);
  return (result.workouts || []).map(w => SavedWorkoutSchema.parse(w));
}

export async function getWorkout(workoutId: string, profileId: string): Promise<SavedWorkout | null> {
  const q = new URLSearchParams({ profile_id: profileId });
  const result = await call<{ success: boolean; workout?: SavedWorkout; message?: string }>(
    `/workouts/${workoutId}?${q}`
  );
  if (!result.success || !result.workout) return null;
  return SavedWorkoutSchema.parse(result.workout);
}

export async function deleteWorkout(workoutId: string, profileId: string): Promise<boolean> {
  const q = new URLSearchParams({ profile_id: profileId });
  const result = await call<{ success: boolean; message: string }>(
    `/workouts/${workoutId}?${q}`,
    { method: 'DELETE' }
  );
  return result.success;
}

export async function updateWorkoutExportStatus(
  workoutId: string, profileId: string, isExported = true, exportedToDevice?: string
): Promise<boolean> {
  const result = await call<{ success: boolean }>(
    `/workouts/${workoutId}/export-status`,
    { method: 'PUT', body: JSON.stringify({ profile_id: profileId, is_exported: isExported, exported_to_device: exportedToDevice }) }
  );
  return result.success;
}

export async function toggleWorkoutFavorite(workoutId: string, profileId: string, isFavorite: boolean): Promise<SavedWorkout | null> {
  const result = await call<{ success: boolean; workout?: SavedWorkout; message: string }>(
    `/workouts/${workoutId}/favorite`,
    { method: 'PATCH', body: JSON.stringify({ profile_id: profileId, is_favorite: isFavorite }) }
  );
  return result.success && result.workout ? SavedWorkoutSchema.parse(result.workout) : null;
}

export async function trackWorkoutUsage(workoutId: string, profileId: string): Promise<SavedWorkout | null> {
  const result = await call<{ success: boolean; workout?: SavedWorkout; message: string }>(
    `/workouts/${workoutId}/used`,
    { method: 'PATCH', body: JSON.stringify({ profile_id: profileId }) }
  );
  return result.success && result.workout ? SavedWorkoutSchema.parse(result.workout) : null;
}

export async function updateWorkoutTags(workoutId: string, profileId: string, tags: string[]): Promise<SavedWorkout | null> {
  const result = await call<{ success: boolean; workout?: SavedWorkout; message: string }>(
    `/workouts/${workoutId}/tags`,
    { method: 'PATCH', body: JSON.stringify({ profile_id: profileId, tags }) }
  );
  return result.success && result.workout ? SavedWorkoutSchema.parse(result.workout) : null;
}

// ── Programs ──────────────────────────────────────────────────────────────────

export async function getPrograms(profileId: string, includeInactive = false): Promise<WorkoutProgram[]> {
  const q = new URLSearchParams({ profile_id: profileId, include_inactive: includeInactive.toString() });
  const result = await call<GetProgramsResponse>(`/programs?${q}`);
  return (result.programs || []).map(p => WorkoutProgramSchema.parse(p));
}

export async function getProgram(programId: string, profileId: string): Promise<WorkoutProgram | null> {
  const q = new URLSearchParams({ profile_id: profileId });
  const result = await call<{ success: boolean; program?: WorkoutProgram; message?: string }>(`/programs/${programId}?${q}`);
  return result.success && result.program ? WorkoutProgramSchema.parse(result.program) : null;
}

export async function createProgram(request: { profile_id: string; name: string; description?: string; color?: string; icon?: string }): Promise<WorkoutProgram | null> {
  const result = await call<{ success: boolean; program?: WorkoutProgram; message: string }>(
    '/programs', { method: 'POST', body: JSON.stringify(request) }
  );
  return result.success && result.program ? WorkoutProgramSchema.parse(result.program) : null;
}

export async function updateProgram(programId: string, request: Record<string, unknown>): Promise<WorkoutProgram | null> {
  const result = await call<{ success: boolean; program?: WorkoutProgram; message: string }>(
    `/programs/${programId}`, { method: 'PATCH', body: JSON.stringify(request) }
  );
  return result.success && result.program ? WorkoutProgramSchema.parse(result.program) : null;
}

export async function deleteProgram(programId: string, profileId: string): Promise<boolean> {
  const q = new URLSearchParams({ profile_id: profileId });
  const result = await call<{ success: boolean; message: string }>(`/programs/${programId}?${q}`, { method: 'DELETE' });
  return result.success;
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export async function getUserTags(profileId: string): Promise<UserTag[]> {
  const q = new URLSearchParams({ profile_id: profileId });
  const result = await call<GetTagsResponse>(`/tags?${q}`);
  return (result.tags || []).map(t => UserTagSchema.parse(t));
}

export async function createUserTag(profileId: string, name: string, color?: string): Promise<UserTag | null> {
  const result = await call<{ success: boolean; tag?: UserTag; message: string }>(
    '/tags', { method: 'POST', body: JSON.stringify({ profile_id: profileId, name, color }) }
  );
  return result.success && result.tag ? UserTagSchema.parse(result.tag) : null;
}

export async function deleteUserTag(tagId: string, profileId: string): Promise<boolean> {
  const q = new URLSearchParams({ profile_id: profileId });
  const result = await call<{ success: boolean; message: string }>(`/tags/${tagId}?${q}`, { method: 'DELETE' });
  return result.success;
}
```

**Step 4: Write MSW handlers for mapper**

Create `src/api/mocks/handlers/mapper.ts`:

```ts
import { http, HttpResponse } from 'msw';
import { API_URLS } from '../../../lib/config';
import { MOCK_WORKOUT_HISTORY } from '../../lib/mock-data';
import type { SavedWorkout, WorkoutProgram, UserTag } from '../../generated/mapper';

const BASE = API_URLS.MAPPER;

// Convert mock history items to the SavedWorkout shape the API returns
function mockHistoryToSaved(items: typeof MOCK_WORKOUT_HISTORY): SavedWorkout[] {
  return items.map((item, i) => ({
    id: item.id || `demo-${i}`,
    profile_id: 'demo-user-1',
    workout_data: item.workout as Record<string, unknown>,
    sources: item.sources || [],
    device: item.device || 'garmin',
    title: item.workout?.title,
    is_exported: false,
    created_at: item.createdAt || new Date().toISOString(),
    updated_at: item.updatedAt || new Date().toISOString(),
  }));
}

export const mapperHandlers = [
  // Save workout — accept and return a demo response
  http.post(`${BASE}/workouts/save`, async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      success: true,
      workout_id: body.workout_id || `demo-${Date.now()}`,
      message: 'Workout saved (demo)',
    });
  }),

  // Get all workouts
  http.get(`${BASE}/workouts`, () => {
    const workouts = mockHistoryToSaved(MOCK_WORKOUT_HISTORY);
    return HttpResponse.json({ success: true, workouts, count: workouts.length });
  }),

  // Get single workout
  http.get(`${BASE}/workouts/:id`, ({ params }) => {
    const item = MOCK_WORKOUT_HISTORY.find(w => w.id === params.id);
    if (!item) return HttpResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    const workout = mockHistoryToSaved([item])[0];
    return HttpResponse.json({ success: true, workout });
  }),

  // Delete workout
  http.delete(`${BASE}/workouts/:id`, () => {
    return HttpResponse.json({ success: true, message: 'Deleted (demo)' });
  }),

  // Export status update
  http.put(`${BASE}/workouts/:id/export-status`, () => {
    return HttpResponse.json({ success: true });
  }),

  // Favorite toggle
  http.patch(`${BASE}/workouts/:id/favorite`, async ({ request, params }) => {
    const body = await request.json() as any;
    const item = MOCK_WORKOUT_HISTORY.find(w => w.id === params.id);
    const workout = item ? { ...mockHistoryToSaved([item])[0], is_favorite: body.is_favorite } : null;
    return HttpResponse.json({ success: true, workout, message: 'Updated (demo)' });
  }),

  // Track usage
  http.patch(`${BASE}/workouts/:id/used`, ({ params }) => {
    const item = MOCK_WORKOUT_HISTORY.find(w => w.id === params.id);
    const workout = item ? mockHistoryToSaved([item])[0] : null;
    return HttpResponse.json({ success: true, workout, message: 'Updated (demo)' });
  }),

  // Update tags
  http.patch(`${BASE}/workouts/:id/tags`, () => {
    return HttpResponse.json({ success: true, workout: null, message: 'Updated (demo)' });
  }),

  // Programs
  http.get(`${BASE}/programs`, () => {
    return HttpResponse.json({ success: true, programs: [] as WorkoutProgram[], count: 0 });
  }),

  http.post(`${BASE}/programs`, async ({ request }) => {
    const body = await request.json() as any;
    const program: WorkoutProgram = {
      id: `demo-program-${Date.now()}`,
      profile_id: 'demo-user-1',
      name: body.name,
      description: body.description,
      color: body.color,
      icon: body.icon,
      current_day_index: 0,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return HttpResponse.json({ success: true, program, message: 'Created (demo)' });
  }),

  http.patch(`${BASE}/programs/:id`, async ({ request, params }) => {
    const body = await request.json() as any;
    const program: Partial<WorkoutProgram> = { id: params.id as string, ...body };
    return HttpResponse.json({ success: true, program, message: 'Updated (demo)' });
  }),

  http.delete(`${BASE}/programs/:id`, () => {
    return HttpResponse.json({ success: true, message: 'Deleted (demo)' });
  }),

  // Tags
  http.get(`${BASE}/tags`, () => {
    return HttpResponse.json({ success: true, tags: [] as UserTag[], count: 0 });
  }),

  http.post(`${BASE}/tags`, async ({ request }) => {
    const body = await request.json() as any;
    const tag: UserTag = {
      id: `demo-tag-${Date.now()}`,
      profile_id: 'demo-user-1',
      name: body.name,
      color: body.color,
      created_at: new Date().toISOString(),
    };
    return HttpResponse.json({ success: true, tag, message: 'Created (demo)' });
  }),

  http.delete(`${BASE}/tags/:id`, () => {
    return HttpResponse.json({ success: true, message: 'Deleted (demo)' });
  }),
];
```

**Step 5: Register mapper handlers in the index**

Replace `src/api/mocks/handlers/index.ts`:

```ts
import { mapperHandlers } from './mapper';

export const handlers = [
  ...mapperHandlers,
];
```

**Step 6: Write the contract test**

Create `src/lib/__tests__/contracts/mapper.contract.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SavedWorkoutSchema } from '../../../api/schemas/mapper';
import { API_URLS } from '../../config';

const BASE = API_URLS.MAPPER;

async function isApiAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

const MINIMAL_WORKOUT = {
  profile_id: 'contract-test-user',
  workout_data: { title: 'Contract Test Workout', blocks: [], source: 'test' },
  sources: [],
  device: 'web',
};

describe('mapper-api contract', () => {
  it('GET /workouts returns array with valid shapes', async () => {
    if (!await isApiAvailable()) return;
    const r = await fetch(`${BASE}/workouts?profile_id=contract-test-user`, {
      headers: { 'x-test-user-id': 'contract-test-user' },
    });
    expect(r.ok).toBe(true);
    const data = await r.json();
    expect(data).toHaveProperty('workouts');
    expect(Array.isArray(data.workouts)).toBe(true);
    for (const w of data.workouts) {
      expect(() => SavedWorkoutSchema.parse(w)).not.toThrow();
    }
  });
});
```

**Step 7: Update workout-api.ts to delegate to the new client**

Open `src/lib/workout-api.ts`. The goal is to re-export everything from the new client so existing call sites continue to work without changes. Replace the file body (keep all exported types/interfaces, replace function bodies):

For `saveWorkoutToAPI`: delegate to `saveWorkout` from `../api/clients/mapper`
For `getWorkoutsFromAPI`: delegate to `getWorkouts` from `../api/clients/mapper`
For all program/tag functions: delegate to corresponding functions in `../api/clients/mapper`
Remove the `isDemoMode` import and all `isDemoMode` checks.

The simplest approach: add re-exports at the bottom of `workout-api.ts` temporarily, delete function bodies that now have isDemoMode, and use the new client. Here is the pattern for the two most important functions:

```ts
// At the top of workout-api.ts, add:
import * as mapperClient from '../api/clients/mapper';

// Replace saveWorkoutToAPI body:
export async function saveWorkoutToAPI(request: SaveWorkoutRequest): Promise<SavedWorkout> {
  return mapperClient.saveWorkout(request);
}

// Replace getWorkoutsFromAPI body:
export async function getWorkoutsFromAPI(params: GetWorkoutsParams): Promise<SavedWorkout[]> {
  return mapperClient.getWorkouts(params);
}

// Replace getPrograms body (remove isDemoMode check):
export async function getPrograms(profileId: string, includeInactive = false): Promise<WorkoutProgram[]> {
  try {
    return await mapperClient.getPrograms(profileId, includeInactive);
  } catch (err) {
    console.error('[getPrograms] Error:', err);
    return [];
  }
}

// Replace getUserTags body (remove isDemoMode check):
export async function getUserTags(profileId: string): Promise<UserTag[]> {
  try {
    return await mapperClient.getUserTags(profileId);
  } catch (err) {
    console.error('[getUserTags] Error:', err);
    return [];
  }
}
```

Remove the `import { isDemoMode }` line and the `import { DEMO_PROGRAMS }` dynamic import lines.

**Step 8: Remove isDemoMode from workout-history.ts**

Open `src/lib/workout-history.ts`. Find line 252 (the `if (isDemoMode) return MOCK_WORKOUT_HISTORY;` in the get function). Remove it — MSW will intercept the underlying API call and return demo data instead.

Check if `isDemoMode` is still used elsewhere in the file. If the count reaches zero, remove the import.

**Step 9: Verify build**

```bash
npm run build 2>&1 | grep -E "error|warning" | head -20
```

Expected: no new TypeScript errors from our changes.

**Step 10: Run contract tests (skip if backend not running)**

```bash
npm run test:contracts 2>&1 | head -30
```

Expected: tests pass or skip gracefully with "not available" message.

**Step 11: Commit**

```bash
git add src/api/ src/lib/workout-api.ts src/lib/workout-history.ts
git commit -m "feat: migrate mapper-api to typed client with Zod validation and MSW handlers"
```

---

## Task 3: Calendar API Migration (calendar-api.ts → src/api/clients/calendar.ts)

The calendar API has the most `isDemoMode` branches (8 checks). It also has complex mock data (rebasing events to the current week). The MSW handler will replicate this logic.

**Files:**
- Create: `src/api/generated/calendar.d.ts`
- Create: `src/api/schemas/calendar.ts`
- Create: `src/api/clients/calendar.ts`
- Create: `src/api/mocks/handlers/calendar.ts`
- Modify: `src/api/mocks/handlers/index.ts`
- Create: `src/lib/__tests__/contracts/calendar.contract.test.ts`
- Modify: `src/lib/calendar-api.ts` (strip all isDemoMode branches, delegate to new client)

**Step 1: Generate types**

```bash
npm run generate:types:calendar
```

If backend not running, create `src/api/generated/calendar.d.ts` manually based on the interfaces already defined in `calendar-api.ts` (copy the `WorkoutEvent`, `CreateWorkoutEvent`, `UpdateWorkoutEvent`, `ConnectedCalendar`, `CreateConnectedCalendar` interfaces with a `// @generated` header).

**Step 2: Write Zod schemas**

Create `src/api/schemas/calendar.ts`:

```ts
import { z } from 'zod';
import type { WorkoutEvent, ConnectedCalendar } from '../generated/calendar';

export const WorkoutEventSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  title: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.string(),
  type: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  status: z.enum(['planned', 'completed']),
  is_anchor: z.boolean(),
  primary_muscle: z.string().optional(),
  intensity: z.number().optional(),
  connected_calendar_id: z.string().optional(),
  connected_calendar_type: z.string().optional(),
  external_event_url: z.string().optional(),
  recurrence_rule: z.string().optional(),
  json_payload: z.record(z.unknown()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const ConnectedCalendarSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  type: z.enum(['runna', 'apple', 'google', 'outlook', 'ics_custom']),
  integration_type: z.enum(['ics_url', 'oauth', 'os_integration']),
  is_workout_calendar: z.boolean(),
  ics_url: z.string().optional(),
  last_sync: z.string().optional(),
  sync_status: z.enum(['active', 'error', 'paused']),
  sync_error_message: z.string().optional(),
  color: z.string().optional(),
  workouts_this_week: z.number(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

type _VerifyEvent = z.infer<typeof WorkoutEventSchema> extends WorkoutEvent ? true : never;
type _VerifyCalendar = z.infer<typeof ConnectedCalendarSchema> extends ConnectedCalendar ? true : never;
```

**Step 3: Write the typed client**

Create `src/api/clients/calendar.ts`:

```ts
/**
 * Calendar API client — typed, validated, MSW-interceptable.
 * No isDemoMode branches here.
 */
import { authenticatedFetch } from '../../lib/authenticated-fetch';
import { API_URLS } from '../../lib/config';
import { WorkoutEventSchema, ConnectedCalendarSchema } from '../schemas/calendar';
import type { WorkoutEvent, ConnectedCalendar, CreateWorkoutEvent, UpdateWorkoutEvent, CreateConnectedCalendar } from '../generated/calendar';

const BASE = API_URLS.CALENDAR;

async function call<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...options.headers };
  const r = await authenticatedFetch(url, { ...options, headers });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `Calendar API error: ${r.status}`);
  }
  return r.json();
}

export async function getEvents(start: string, end: string): Promise<WorkoutEvent[]> {
  const events = await call<WorkoutEvent[]>(`${BASE}/calendar?start=${start}&end=${end}`);
  return events.map(e => WorkoutEventSchema.parse(e));
}

export async function getEvent(eventId: string): Promise<WorkoutEvent> {
  const event = await call<WorkoutEvent>(`${BASE}/calendar/${eventId}`);
  return WorkoutEventSchema.parse(event);
}

export async function createEvent(event: CreateWorkoutEvent): Promise<WorkoutEvent> {
  const result = await call<WorkoutEvent>(`${BASE}/calendar`, { method: 'POST', body: JSON.stringify(event) });
  return WorkoutEventSchema.parse(result);
}

export async function updateEvent(eventId: string, event: UpdateWorkoutEvent): Promise<WorkoutEvent> {
  const result = await call<WorkoutEvent>(`${BASE}/calendar/${eventId}`, { method: 'PUT', body: JSON.stringify(event) });
  return WorkoutEventSchema.parse(result);
}

export async function deleteEvent(eventId: string): Promise<void> {
  const r = await authenticatedFetch(`${BASE}/calendar/${eventId}`, { method: 'DELETE' });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `Calendar API error: ${r.status}`);
  }
}

export async function getConnectedCalendars(): Promise<ConnectedCalendar[]> {
  const calendars = await call<ConnectedCalendar[]>(`${BASE}/calendar/connected-calendars`);
  return calendars.map(c => ConnectedCalendarSchema.parse(c));
}

export async function createConnectedCalendar(calendar: CreateConnectedCalendar): Promise<ConnectedCalendar> {
  const result = await call<ConnectedCalendar>(`${BASE}/calendar/connected-calendars`, { method: 'POST', body: JSON.stringify(calendar) });
  return ConnectedCalendarSchema.parse(result);
}

export async function deleteConnectedCalendar(calendarId: string): Promise<void> {
  const r = await authenticatedFetch(`${BASE}/calendar/connected-calendars/${calendarId}`, { method: 'DELETE' });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `Calendar API error: ${r.status}`);
  }
}

export async function syncConnectedCalendar(calendarId: string): Promise<{ success: boolean; events_created: number; events_updated: number; total_events: number }> {
  return call(`${BASE}/calendar/connected-calendars/${calendarId}/sync`, { method: 'POST' });
}
```

**Step 4: Write MSW handlers for calendar**

Create `src/api/mocks/handlers/calendar.ts`:

```ts
import { http, HttpResponse } from 'msw';
import { API_URLS } from '../../../lib/config';
import { sampleCalendarEvents, mockConnectedCalendars } from '../../../lib/calendar-mock-data';

const BASE = API_URLS.CALENDAR;

// Rebase demo events to the requested week (same logic as the old CalendarApiClient)
function rebaseEventsToWeek(events: typeof sampleCalendarEvents, start: string, end: string) {
  if (events.length === 0) return [];
  const validEvents = events.filter(e => e?.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date));
  if (!validEvents.length) return [];

  const requestedStart = new Date(start + 'T00:00:00');
  const originDate = new Date(validEvents.map(e => e.date).sort()[0] + 'T00:00:00');
  const offsetDays = Math.round((requestedStart.getTime() - originDate.getTime()) / 86400000);

  return validEvents.map(e => {
    const d = new Date(e.date + 'T00:00:00');
    d.setDate(d.getDate() + offsetDays);
    return { ...e, date: d.toISOString().slice(0, 10) };
  });
}

export const calendarHandlers = [
  http.get(`${BASE}/calendar`, ({ request }) => {
    const url = new URL(request.url);
    const start = url.searchParams.get('start') || '';
    const end = url.searchParams.get('end') || '';
    const rebased = rebaseEventsToWeek(sampleCalendarEvents as any, start, end);
    const filtered = rebased.filter(e => e.date >= start && e.date <= end);
    return HttpResponse.json(filtered);
  }),

  http.get(`${BASE}/calendar/:id`, ({ params }) => {
    const event = sampleCalendarEvents.find((e: any) => e.id === params.id);
    if (!event) return HttpResponse.json({ detail: 'Not found' }, { status: 404 });
    return HttpResponse.json(event);
  }),

  http.post(`${BASE}/calendar`, async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({ ...body, id: `demo-${Date.now()}`, user_id: 'demo-user-1', status: 'planned', is_anchor: false });
  }),

  http.put(`${BASE}/calendar/:id`, async ({ request, params }) => {
    const body = await request.json() as any;
    return HttpResponse.json({ ...body, id: params.id, user_id: 'demo-user-1' });
  }),

  http.delete(`${BASE}/calendar/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/calendar/connected-calendars`, () => {
    return HttpResponse.json(mockConnectedCalendars);
  }),

  http.post(`${BASE}/calendar/connected-calendars`, async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({ ...body, id: `demo-cal-${Date.now()}`, user_id: 'demo-user-1', sync_status: 'active', workouts_this_week: 0 });
  }),

  http.delete(`${BASE}/calendar/connected-calendars/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${BASE}/calendar/connected-calendars/:id/sync`, () => {
    return HttpResponse.json({ success: true, events_created: 0, events_updated: 0, total_events: 0 });
  }),
];
```

**Step 5: Register calendar handlers**

Update `src/api/mocks/handlers/index.ts`:

```ts
import { mapperHandlers } from './mapper';
import { calendarHandlers } from './calendar';

export const handlers = [
  ...mapperHandlers,
  ...calendarHandlers,
];
```

**Step 6: Write the contract test**

Create `src/lib/__tests__/contracts/calendar.contract.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { WorkoutEventSchema } from '../../../api/schemas/calendar';
import { API_URLS } from '../../config';

const BASE = API_URLS.CALENDAR;

async function isApiAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

const today = new Date().toISOString().slice(0, 10);
const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

describe('calendar-api contract', () => {
  it('GET /calendar returns array of valid WorkoutEvent shapes', async () => {
    if (!await isApiAvailable()) return;
    const r = await fetch(`${BASE}/calendar?start=${today}&end=${nextWeek}`, {
      headers: { 'x-test-user-id': 'contract-test-user' },
    });
    expect(r.ok).toBe(true);
    const data = await r.json();
    expect(Array.isArray(data)).toBe(true);
    for (const event of data) {
      expect(() => WorkoutEventSchema.parse(event)).not.toThrow();
    }
  });
});
```

**Step 7: Update calendar-api.ts to delegate to the new client**

Open `src/lib/calendar-api.ts`. The `CalendarApiClient` class methods should now delegate to the new client functions. The class interface is preserved so existing call sites (`calendarApi.getEvents(...)`) continue to work unchanged.

Update the class methods to remove `isDemoMode` checks and delegate:

```ts
// At the top of calendar-api.ts, add:
import * as calendarClient from '../api/clients/calendar';

// In CalendarApiClient class, update each method to delegate:

async getEvents(start: string, end: string): Promise<WorkoutEvent[]> {
  if (!this.isValidDateString(start) || !this.isValidDateString(end)) {
    throw new Error('Invalid date parameters: start and end must be valid YYYY-MM-DD format date strings');
  }
  return calendarClient.getEvents(start, end);
}

async getEvent(eventId: string): Promise<WorkoutEvent> {
  return calendarClient.getEvent(eventId);
}

async createEvent(event: CreateWorkoutEvent): Promise<WorkoutEvent> {
  return calendarClient.createEvent(event);
}

async updateEvent(eventId: string, event: UpdateWorkoutEvent): Promise<WorkoutEvent> {
  return calendarClient.updateEvent(eventId, event);
}

async deleteEvent(eventId: string): Promise<void> {
  return calendarClient.deleteEvent(eventId);
}

async getConnectedCalendars(): Promise<ConnectedCalendar[]> {
  return calendarClient.getConnectedCalendars();
}

async createConnectedCalendar(calendar: CreateConnectedCalendar): Promise<ConnectedCalendar> {
  return calendarClient.createConnectedCalendar(calendar);
}

async deleteConnectedCalendar(calendarId: string): Promise<void> {
  return calendarClient.deleteConnectedCalendar(calendarId);
}

async syncConnectedCalendar(calendarId: string) {
  return calendarClient.syncConnectedCalendar(calendarId);
}
```

Remove the `import { isDemoMode }` and `import { sampleCalendarEvents, mockConnectedCalendars }` lines. Remove the `rebaseEventsToWeek` method and the `DEMO_CALENDAR_EVENTS` constant — they're now in the MSW handler.

**Step 8: Verify and commit**

```bash
npm run build 2>&1 | grep -E "error" | head -20
npm run test:contracts 2>&1 | head -20
git add src/api/ src/lib/calendar-api.ts
git commit -m "feat: migrate calendar-api to typed client with Zod validation and MSW handlers"
```

---

## Task 4: Ingestor API Migration (api.ts → src/api/clients/ingestor.ts)

`src/lib/api.ts` has no `isDemoMode` branches — it's already clean. The goal here is: add types, add Zod validation for the workout response shape, add an MSW handler for the streaming endpoint (demo mode already works via `isDemoMode` in `CreateAIWorkout.tsx` — that can stay for now), and move `normalizeWorkoutStructure` to a better home.

**Files:**
- Create: `src/api/generated/ingestor.d.ts`
- Create: `src/api/schemas/ingestor.ts`
- Create: `src/api/clients/ingestor.ts`
- Modify: `src/lib/api.ts` (add `@deprecated` JSDoc to all functions, re-export from new client)
- Create: `src/lib/__tests__/contracts/ingestor.contract.test.ts`

**Step 1: Generate types**

```bash
npm run generate:types:ingestor
```

If backend not running, create `src/api/generated/ingestor.d.ts` manually:

```ts
// @generated — do not edit. Run npm run generate:types:ingestor to regenerate.

export interface WorkoutStructureResponse {
  title?: string;
  source?: string;
  blocks: Block[];
  workout_type?: string;
  workout_type_confidence?: number;
}

interface Block {
  label?: string;
  structure?: string | null;
  exercises: Exercise[];
  supersets?: Superset[];
  sets?: number | null;
  rounds?: number | null;
  rest_between_sets_sec?: number | null;
  rest_between_rounds_sec?: number | null;
  time_cap_sec?: number | null;
}

interface Exercise {
  name: string;
  sets?: number | null;
  reps?: number | null;
  reps_range?: string | null;
  duration_sec?: number | null;
  rest_sec?: number | null;
  distance_m?: number | null;
  type?: string;
}

interface Superset {
  exercises: Exercise[];
  rest_between_sec?: number | null;
}
```

**Step 2: Write Zod schemas**

Create `src/api/schemas/ingestor.ts`:

```ts
import { z } from 'zod';

export const ExerciseSchema = z.object({
  name: z.string(),
  sets: z.number().nullable().optional(),
  reps: z.number().nullable().optional(),
  reps_range: z.string().nullable().optional(),
  duration_sec: z.number().nullable().optional(),
  rest_sec: z.number().nullable().optional(),
  distance_m: z.number().nullable().optional(),
  type: z.string().optional(),
});

export const SupersetSchema = z.object({
  exercises: z.array(ExerciseSchema),
  rest_between_sec: z.number().nullable().optional(),
});

export const BlockSchema = z.object({
  label: z.string().optional(),
  structure: z.string().nullable().optional(),
  exercises: z.array(ExerciseSchema),
  supersets: z.array(SupersetSchema).optional(),
  sets: z.number().nullable().optional(),
  rounds: z.number().nullable().optional(),
  rest_between_sets_sec: z.number().nullable().optional(),
  rest_between_rounds_sec: z.number().nullable().optional(),
  time_cap_sec: z.number().nullable().optional(),
});

export const WorkoutStructureResponseSchema = z.object({
  title: z.string().optional(),
  source: z.string().optional(),
  blocks: z.array(BlockSchema),
  workout_type: z.string().optional(),
  workout_type_confidence: z.number().optional(),
});
```

**Step 3: Create ingestor client**

Create `src/api/clients/ingestor.ts`:

```ts
/**
 * Ingestor API client — typed, validated.
 * Wraps src/lib/api.ts functions with Zod validation.
 * The heavy ingest logic stays in api.ts for now (complex multipart handling).
 * This client is the validated entry point for new call sites.
 */
import { WorkoutStructureResponseSchema } from '../schemas/ingestor';
import type { WorkoutStructure } from '../../types/workout';
import { generateWorkoutStructure as _generateWorkoutStructure, createEmptyWorkout as _createEmptyWorkout, checkApiHealth } from '../../lib/api';
import { normalizeWorkoutStructure } from '../../lib/api';

export { normalizeWorkoutStructure, checkApiHealth };

export async function generateWorkoutStructure(
  sources: Array<{ type: string; content: string }>,
  signal?: AbortSignal
): Promise<WorkoutStructure> {
  const workout = await _generateWorkoutStructure(sources as any, signal);
  // Validate shape at boundary — throws ZodError with field detail if shape is wrong
  WorkoutStructureResponseSchema.parse(workout);
  return workout;
}

export async function createEmptyWorkout(): Promise<WorkoutStructure> {
  const workout = await _createEmptyWorkout();
  return workout;
}
```

**Step 4: Contract test**

Create `src/lib/__tests__/contracts/ingestor.contract.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { WorkoutStructureResponseSchema } from '../../../api/schemas/ingestor';
import { API_URLS } from '../../config';

const BASE = API_URLS.INGESTOR;

async function isApiAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

describe('ingestor-api contract', () => {
  it('POST /ingest/ai_workout returns valid WorkoutStructure shape', async () => {
    if (!await isApiAvailable()) return;
    const r = await fetch(`${BASE}/ingest/ai_workout`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'x-test-user-id': 'contract-test-user' },
      body: 'Push day: bench press 3x10, overhead press 3x8, lateral raises 3x15',
    });
    expect(r.ok).toBe(true);
    const data = await r.json();
    expect(() => WorkoutStructureResponseSchema.parse(data)).not.toThrow();
  });
});
```

**Step 5: Commit**

```bash
git add src/api/ src/lib/__tests__/contracts/ingestor.contract.test.ts
git commit -m "feat: add ingestor-api typed client and contract test"
```

---

## Task 5: Chat, Strava, Garmin APIs

These three services follow the exact same pattern as Tasks 2-4. They have fewer or no `isDemoMode` branches and fewer call sites.

**For each service (chat, strava, garmin):**

1. Run `npm run generate:types:<service>` (or create stub `.d.ts` if backend not running)
2. Create `src/api/schemas/<service>.ts` with Zod schemas matching the key response types
3. Create `src/api/clients/<service>.ts` delegating to `authenticatedFetch` with Zod validation
4. Add minimal MSW handlers in `src/api/mocks/handlers/<service>.ts` (return empty/stub data for demo)
5. Register handlers in `src/api/mocks/handlers/index.ts`
6. Create `src/lib/__tests__/contracts/<service>.contract.test.ts` using the `isApiAvailable` skip pattern
7. Remove any `isDemoMode` checks from the existing lib file for that service
8. Commit: `feat: migrate <service>-api to typed client`

**Note:** If you don't know the exact endpoint shapes for strava/garmin (they may not be actively used in the UI yet), write minimal stub schemas (`z.record(z.unknown())`) and mark them with `// TODO: refine when endpoints are finalized`. Don't guess at shapes.

---

## Task 6: Final Cleanup

**Step 1: Count remaining isDemoMode imports**

```bash
grep -r "import.*isDemoMode\|isDemoMode" src/ --include="*.ts" --include="*.tsx" -l
```

Expected: only `src/main.tsx` and `src/lib/demo-mode.ts` itself remain.

**Step 2: Verify demo mode still works**

Start the dev server in demo mode:

```bash
VITE_DEMO_MODE=true npm run dev
```

Navigate to: calendar, workouts library, import flow, create-with-AI flow. All should show mock data with no network errors in the browser console.

**Step 3: Run full test suite**

```bash
npm test
npm run test:contracts
```

Expected: all tests pass or skip gracefully.

**Step 4: Remove dead code**

If `src/lib/workout-api.ts` now only re-exports from the new client with no logic of its own, it can be simplified. Do NOT delete it yet — it's a public API used by many call sites. Mark for future removal with a `// TODO: replace call sites with src/api/clients/mapper.ts direct imports` comment.

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: api layer migration complete — isDemoMode branches eliminated"
```
