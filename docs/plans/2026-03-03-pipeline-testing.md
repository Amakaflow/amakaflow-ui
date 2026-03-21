# Pipeline Integration Testing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a testable pipeline layer and scenario-based integration tests so multi-API flows (ingestor → mapper) are verified end-to-end, with typed errors caught before the UI, and schema drift caught in CI.

**Architecture:** Extract orchestration from React hooks into pure pipeline functions in `src/api/pipelines/`. Add JSON fixture files in `src/api/fixtures/` that serve as both MSW data sources and schema-validation targets. Integration tests use `msw/node` to intercept fetch in Vitest. Phase 1 fixes 8 pre-existing failing tests as a prerequisite. Phases 2–4 build the pipeline layer and tests.

**Tech Stack:** Vitest (already installed), msw/node (already installed — msw is a dep), Zod schemas from `src/api/schemas/`, TypeScript

---

### Task 1: Diagnose and fix the 8 failing unit tests

**Context:** `isDemoMode` is `export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'` — a module-level constant evaluated at import time. Tests that import components or hooks that touch this constant must call `vi.mock()` before any import. Vitest hoists `vi.mock()` calls to the top of the file automatically, but only if they appear at module scope (not inside functions or describe blocks).

**Files:**
- Diagnose: `src/components/__tests__/BlockConfigRow.test.tsx`
- Diagnose: `src/app/__tests__/NavBar.test.tsx`
- Diagnose: `src/app/hooks/__tests__/useWorkflowEditing.test.ts`
- Diagnose: `src/components/__tests__/workout-utils.test.ts`
- Diagnose: `src/lib/__tests__/demo-mode.test.ts`

**Step 1: Run the test suite and capture exact failures**

```bash
cd /Users/davidandrews/dev/AmakaFlow/amakaflow-ui
npx vitest run --reporter=verbose 2>&1 | grep -A 5 "FAIL\|Error\|× " | head -100
```

Expected: See exactly which tests fail and the error message for each. This tells you what mock is missing.

**Step 2: Fix BlockConfigRow.test.tsx**

Check if `BlockConfigRow` imports from `demo-mode` (directly or via a dependency). If it does, add the mock at the top of the test file (before all imports — Vitest hoists these):

```ts
// Add at top of src/components/__tests__/BlockConfigRow.test.tsx, before existing imports
vi.mock('../../lib/demo-mode', () => ({
  isDemoMode: false,
}));
```

If `BlockConfigRow` does NOT import demo-mode at all, the failure has a different cause — read the actual error message from Step 1.

**Step 3: Fix NavBar.test.tsx**

The file already has `vi.mock('../../lib/demo-mode', () => ({ isDemoMode: false }))` at module scope. If it's still failing, check whether `NavBar` imports anything that imports demo-mode transitively (e.g., a hook). Add mocks for those too.

Read the test failure message from Step 1. If the error is `isDemoMode is not a function` or `cannot read property of undefined`, it means a transitive import is the problem.

**Step 4: Fix workout-utils.test.ts**

This tests pure utility functions — no API, no demo-mode. It should not need any mocks. If it fails, read the exact error from Step 1. Common causes:
- Import path is wrong
- `src/lib/workout-utils.ts` has a syntax error or imports something that breaks

Run just this file to see the error clearly:
```bash
npx vitest run src/components/__tests__/workout-utils.test.ts --reporter=verbose
```

Fix whatever the error message says.

**Step 5: Fix useWorkflowEditing.test.ts**

The test file already mocks `workout-history` and `api`. Run it in isolation to see if there are additional failures:
```bash
npx vitest run src/app/hooks/__tests__/useWorkflowEditing.test.ts --reporter=verbose
```

If it fails with `Cannot find module` or similar for `../../lib/demo-mode`, the hook imports demo-mode. Add:
```ts
// At top of src/app/hooks/__tests__/useWorkflowEditing.test.ts (before existing vi.mock calls)
vi.mock('../../../lib/demo-mode', () => ({
  isDemoMode: false,
}));
```

**Step 6: Run the full suite and verify all 8 failures are gone**

```bash
npx vitest run --reporter=dot 2>&1 | tail -20
```

Expected output ends with something like: `X passed, 0 failed` (or similar — the 8 failures should be gone). If new failures appear, fix them before proceeding.

**Step 7: Commit**

```bash
git add src/components/__tests__/BlockConfigRow.test.tsx \
        src/app/__tests__/NavBar.test.tsx \
        src/app/hooks/__tests__/useWorkflowEditing.test.ts \
        src/components/__tests__/workout-utils.test.ts
git commit -m "fix: resolve pre-existing vi.mock timing failures in unit tests"
```

---

### Task 2: Create PipelineError and the pipeline index

**Context:** `src/api/` was created by PR #240 (the API layer). It contains `clients/`, `schemas/`, and `mocks/`. We're adding `pipelines/` as a new subdirectory. `PipelineError` is a typed error class that the UI can `instanceof`-check to show actionable messages instead of crashing.

**Files:**
- Create: `src/api/pipelines/index.ts`

**Step 1: Write a failing test first**

```bash
mkdir -p src/lib/__tests__/pipelines
```

Create `src/lib/__tests__/pipelines/pipeline-error.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PipelineError } from '../../../api/pipelines';

describe('PipelineError', () => {
  it('is an instance of Error', () => {
    const err = new PipelineError('UnmappedExercises', {
      unmapped: ['bench press'],
      message: '1 exercise(s) could not be mapped: bench press',
    });
    expect(err).toBeInstanceOf(Error);
  });

  it('has the correct code and detail', () => {
    const err = new PipelineError('IngestorFailed', {
      message: 'Ingestor returned 500',
      status: 500,
    });
    expect(err.code).toBe('IngestorFailed');
    expect(err.detail.status).toBe(500);
  });

  it('message comes from detail.message', () => {
    const err = new PipelineError('UnmappedExercises', {
      message: 'bench press could not be mapped',
      unmapped: ['bench press'],
    });
    expect(err.message).toBe('bench press could not be mapped');
  });

  it('name is PipelineError', () => {
    const err = new PipelineError('ExportFailed', { message: 'export failed' });
    expect(err.name).toBe('PipelineError');
  });
});
```

**Step 2: Run the test to verify it fails**

```bash
npx vitest run src/lib/__tests__/pipelines/pipeline-error.test.ts --reporter=verbose
```

Expected: FAIL with "Cannot find module '../../../api/pipelines'"

**Step 3: Create src/api/pipelines/index.ts**

```ts
// src/api/pipelines/index.ts

export type PipelineErrorCode =
  | 'UnmappedExercises'
  | 'IngestorFailed'
  | 'ExportFailed';

export class PipelineError extends Error {
  readonly code: PipelineErrorCode;
  readonly detail: Record<string, unknown>;

  constructor(code: PipelineErrorCode, detail: Record<string, unknown>) {
    super((detail['message'] as string) ?? code);
    this.name = 'PipelineError';
    this.code = code;
    this.detail = detail;
  }
}
```

**Step 4: Run the test to verify it passes**

```bash
npx vitest run src/lib/__tests__/pipelines/pipeline-error.test.ts --reporter=verbose
```

Expected: 4 tests pass.

**Step 5: Commit**

```bash
git add src/api/pipelines/index.ts src/lib/__tests__/pipelines/pipeline-error.test.ts
git commit -m "feat: add PipelineError class with typed error codes"
```

---

### Task 3: Create the ingestion pipeline function

**Context:** `src/lib/api.ts` has `generateWorkoutStructure()` which calls the ingestor API at `POST /ingest/ai_workout`. `src/api/clients/mapper.ts` has `validateExercises()` which calls the mapper API at `POST /validate`. The pipeline function sequences these two calls and throws `PipelineError('UnmappedExercises', ...)` if mapper returns unmapped exercises.

**Files:**
- Create: `src/api/pipelines/ingestion.ts`
- Modify: `src/api/pipelines/index.ts` (add re-export)

**Step 1: Write failing tests first**

Create `src/lib/__tests__/pipelines/ingestion.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { runIngestionPipeline } from '../../../api/pipelines/ingestion';
import { PipelineError } from '../../../api/pipelines';

// Minimal valid ingestor response
const INGESTOR_RESPONSE = {
  title: 'Push Day',
  blocks: [
    {
      label: 'Main Block',
      structure: 'regular',
      exercises: [
        { name: 'bench press', sets: 3, reps: 10 },
        { name: 'overhead press', sets: 3, reps: 8 },
      ],
    },
  ],
};

// Mapper response — all mapped
const MAPPER_RESPONSE_OK = {
  success: true,
  matches: [
    { original_name: 'bench press', matched_name: 'Bench Press', confidence: 0.97, garmin_id: 'bench_press' },
    { original_name: 'overhead press', matched_name: 'Overhead Press', confidence: 0.94, garmin_id: 'overhead_press' },
  ],
  unmapped: [],
};

// Mapper response — some unmapped
const MAPPER_RESPONSE_UNMAPPED = {
  success: false,
  matches: [],
  unmapped: ['bench press', 'overhead press'],
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Helpers to reduce repetition
function useIngestor(body = INGESTOR_RESPONSE) {
  server.use(http.post('http://localhost:8004/ingest/ai_workout', () => HttpResponse.json(body)));
}
function useMapper(body = MAPPER_RESPONSE_OK) {
  server.use(http.post('http://localhost:8001/validate', () => HttpResponse.json(body)));
}

const TEST_SOURCES = [{ type: 'url', content: 'https://instagram.com/p/abc123' }];

describe('runIngestionPipeline', () => {
  it('returns workout and validation on success', async () => {
    useIngestor();
    useMapper();
    const result = await runIngestionPipeline(TEST_SOURCES);
    expect(result.workout.title).toBe('Push Day');
    expect(result.workout.blocks).toHaveLength(1);
    expect(result.validation.unmapped).toHaveLength(0);
  });

  it('workout has the expected block structure', async () => {
    useIngestor();
    useMapper();
    const { workout } = await runIngestionPipeline(TEST_SOURCES);
    expect(workout.blocks[0].label).toBe('Main Block');
    expect(workout.blocks[0].exercises).toHaveLength(2);
    expect(workout.blocks[0].exercises[0].name).toBe('bench press');
  });

  it('throws PipelineError when exercises are unmapped', async () => {
    useIngestor();
    useMapper(MAPPER_RESPONSE_UNMAPPED);
    await expect(runIngestionPipeline(TEST_SOURCES)).rejects.toThrow(PipelineError);
  });

  it('PipelineError has UnmappedExercises code and lists the exercises', async () => {
    useIngestor();
    useMapper(MAPPER_RESPONSE_UNMAPPED);
    const err = await runIngestionPipeline(TEST_SOURCES).catch((e) => e);
    expect(err.code).toBe('UnmappedExercises');
    expect(err.detail.unmapped).toEqual(['bench press', 'overhead press']);
  });

  it('throws PipelineError when ingestor returns 500', async () => {
    server.use(http.post('http://localhost:8004/ingest/ai_workout', () => HttpResponse.json({ detail: 'server error' }, { status: 500 })));
    await expect(runIngestionPipeline(TEST_SOURCES)).rejects.toThrow(PipelineError);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/__tests__/pipelines/ingestion.test.ts --reporter=verbose
```

Expected: FAIL with "Cannot find module '../../../api/pipelines/ingestion'"

**Step 3: Create src/api/pipelines/ingestion.ts**

First, check what `validateExercises` is called in `src/api/clients/mapper.ts` — read the file to confirm the function name and signature. Then write:

```ts
// src/api/pipelines/ingestion.ts
import { generateWorkoutStructure } from '../../lib/api';
import { validateExercises } from '../clients/mapper';
import { PipelineError } from './index';
import type { WorkoutStructure } from '../../types/workout';
import type { ValidationResponse } from '../../types/workout';

export interface IngestionResult {
  workout: WorkoutStructure;
  validation: ValidationResponse;
}

export async function runIngestionPipeline(
  sources: Array<{ type: string; content: string }>,
  signal?: AbortSignal,
): Promise<IngestionResult> {
  let workout: WorkoutStructure;
  try {
    workout = await generateWorkoutStructure(sources as any, signal);
  } catch (err: any) {
    throw new PipelineError('IngestorFailed', {
      message: err.message ?? 'Ingestor API failed',
      cause: err,
    });
  }

  const exerciseNames = workout.blocks
    .flatMap((b) => b.exercises?.map((e) => e.name) ?? [])
    .filter(Boolean) as string[];

  const validation = await validateExercises(exerciseNames);

  if (validation.unmapped.length > 0) {
    throw new PipelineError('UnmappedExercises', {
      unmapped: validation.unmapped,
      message: `${validation.unmapped.length} exercise(s) could not be mapped: ${validation.unmapped.join(', ')}`,
    });
  }

  return { workout, validation };
}
```

**Important:** Check the exact signature of `validateExercises` in `src/api/clients/mapper.ts` before writing this. If it takes a full workout object rather than an array of names, adjust accordingly.

**Step 4: Add re-export to pipelines/index.ts**

```ts
// Append to src/api/pipelines/index.ts
export { runIngestionPipeline } from './ingestion';
export type { IngestionResult } from './ingestion';
```

**Step 5: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/pipelines/ingestion.test.ts --reporter=verbose
```

Expected: 5 tests pass.

**Step 6: Commit**

```bash
git add src/api/pipelines/ingestion.ts src/api/pipelines/index.ts \
        src/lib/__tests__/pipelines/ingestion.test.ts
git commit -m "feat: add runIngestionPipeline with PipelineError for unmapped exercises"
```

---

### Task 4: Create service fixtures and schema drift detection tests

**Context:** Fixture files are JSON documents containing example valid responses for each service. A separate `fixtures.test.ts` file runs `ZodSchema.parse(fixture)` for each — if a fixture drifts from its Zod schema, CI fails immediately. The schemas live in `src/api/schemas/`.

**Files:**
- Create: `src/api/fixtures/services/mapper.json`
- Create: `src/api/fixtures/services/ingestor.json`
- Create: `src/api/fixtures/services/calendar.json`
- Create: `src/api/fixtures/services/strava.json`
- Create: `src/api/fixtures/services/garmin.json`
- Create: `src/lib/__tests__/fixtures.test.ts`

**Step 1: Read all Zod schemas to understand what valid shapes look like**

```bash
cat src/api/schemas/mapper.ts
cat src/api/schemas/ingestor.ts
cat src/api/schemas/calendar.ts
cat src/api/schemas/strava.ts
cat src/api/schemas/garmin.ts
```

Read each file and construct a minimal valid JSON example for the main response schema in each.

**Step 2: Create src/api/fixtures/services/mapper.json**

Based on `ValidationResponseSchema` in `src/api/schemas/mapper.ts`:

```json
{
  "success": true,
  "matches": [
    {
      "original_name": "bench press",
      "matched_name": "Bench Press",
      "confidence": 0.97,
      "garmin_id": "bench_press"
    }
  ],
  "unmapped": []
}
```

**Step 3: Create src/api/fixtures/services/ingestor.json**

Based on `WorkoutStructureResponseSchema` in `src/api/schemas/ingestor.ts`:

```json
{
  "title": "Push Day",
  "blocks": [
    {
      "label": "Main Block",
      "structure": "regular",
      "exercises": [
        { "name": "bench press", "sets": 3, "reps": 10 }
      ]
    }
  ]
}
```

**Step 4: Create calendar, strava, garmin fixture files**

Follow the same pattern — read the Zod schema for each service, create a minimal valid JSON. Use `null` for nullable fields.

Create `src/api/fixtures/services/calendar.json`, `src/api/fixtures/services/strava.json`, `src/api/fixtures/services/garmin.json` with valid shapes matching their respective schemas.

**Step 5: Write failing fixture validation tests**

Create `src/lib/__tests__/fixtures.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ValidationResponseSchema } from '../../api/schemas/mapper';
import { WorkoutStructureResponseSchema } from '../../api/schemas/ingestor';
// Import other schemas as they exist in src/api/schemas/

import mapperFixture from '../../api/fixtures/services/mapper.json';
import ingestorFixture from '../../api/fixtures/services/ingestor.json';

describe('service fixtures conform to Zod schemas', () => {
  it('mapper fixture matches ValidationResponseSchema', () => {
    expect(() => ValidationResponseSchema.parse(mapperFixture)).not.toThrow();
  });

  it('ingestor fixture matches WorkoutStructureResponseSchema', () => {
    expect(() => WorkoutStructureResponseSchema.parse(ingestorFixture)).not.toThrow();
  });

  // Add one test per service as you create fixture files:
  // it('calendar fixture matches CalendarEventsResponseSchema', () => { ... });
  // it('strava fixture matches StravaActivitySchema', () => { ... });
  // it('garmin fixture matches GarminWorkoutResponseSchema', () => { ... });
});
```

**Step 6: Run tests to verify they fail**

```bash
npx vitest run src/lib/__tests__/fixtures.test.ts --reporter=verbose
```

Expected: FAIL if fixtures don't exist yet, or if fixture shapes don't match schemas.

**Step 7: Fix any shape mismatches until all tests pass**

If a test fails with a Zod error like `Expected string, received undefined at path "matches[0].garmin_id"`, fix the fixture JSON to include the missing field.

Run until all fixture tests pass:
```bash
npx vitest run src/lib/__tests__/fixtures.test.ts --reporter=verbose
```

Expected: All tests pass.

**Step 8: Commit**

```bash
git add src/api/fixtures/ src/lib/__tests__/fixtures.test.ts
git commit -m "feat: add service fixtures and schema drift detection tests"
```

---

### Task 5: Create scenario fixtures for Instagram URL and file upload

**Context:** Scenario fixtures capture a complete pipeline test case: input sources → per-service mock responses → expected output assertions. These are imported by `ingestion.test.ts` to test real-world flows without hardcoding data in the test file.

**Files:**
- Create: `src/api/fixtures/scenarios/instagram-url.json`
- Create: `src/api/fixtures/scenarios/file-upload.json`
- Modify: `src/lib/__tests__/pipelines/ingestion.test.ts` (add scenario-driven tests)

**Step 1: Create src/api/fixtures/scenarios/instagram-url.json**

```json
{
  "description": "Single Instagram URL produces a complete push workout",
  "input": {
    "sources": [{ "type": "url", "content": "https://instagram.com/p/abc123" }]
  },
  "mocks": {
    "ingestor": {
      "title": "Push Day",
      "blocks": [
        {
          "label": "Main Block",
          "structure": "regular",
          "exercises": [
            { "name": "bench press", "sets": 3, "reps": 10 },
            { "name": "overhead press", "sets": 3, "reps": 8 },
            { "name": "tricep pushdown", "sets": 3, "reps": 12 }
          ]
        }
      ]
    },
    "mapper": {
      "success": true,
      "matches": [
        { "original_name": "bench press", "matched_name": "Bench Press", "confidence": 0.97, "garmin_id": "bench_press" },
        { "original_name": "overhead press", "matched_name": "Overhead Press", "confidence": 0.94, "garmin_id": "overhead_press" },
        { "original_name": "tricep pushdown", "matched_name": "Tricep Pushdown", "confidence": 0.91, "garmin_id": "tricep_pushdown" }
      ],
      "unmapped": []
    }
  },
  "expectedOutput": {
    "title": "Push Day",
    "blockCount": 1,
    "exerciseCount": 3
  }
}
```

**Step 2: Create src/api/fixtures/scenarios/file-upload.json**

```json
{
  "description": "PDF/image file upload produces a full-body workout",
  "input": {
    "sources": [{ "type": "file", "content": "data:application/pdf;base64,..." }]
  },
  "mocks": {
    "ingestor": {
      "title": "Full Body Workout",
      "blocks": [
        {
          "label": "Strength",
          "structure": "regular",
          "exercises": [
            { "name": "squat", "sets": 4, "reps": 8 },
            { "name": "deadlift", "sets": 3, "reps": 5 }
          ]
        },
        {
          "label": "Cardio",
          "structure": "regular",
          "exercises": [
            { "name": "row", "sets": 3, "reps": 500 }
          ]
        }
      ]
    },
    "mapper": {
      "success": true,
      "matches": [
        { "original_name": "squat", "matched_name": "Squat", "confidence": 0.99, "garmin_id": "squat" },
        { "original_name": "deadlift", "matched_name": "Deadlift", "confidence": 0.98, "garmin_id": "deadlift" },
        { "original_name": "row", "matched_name": "Rowing", "confidence": 0.90, "garmin_id": "rowing" }
      ],
      "unmapped": []
    }
  },
  "expectedOutput": {
    "title": "Full Body Workout",
    "blockCount": 2,
    "exerciseCount": 3
  }
}
```

**Step 3: Add scenario-driven tests to ingestion.test.ts**

Add these tests to `src/lib/__tests__/pipelines/ingestion.test.ts` (after the existing `describe` block):

```ts
import instagramScenario from '../../../api/fixtures/scenarios/instagram-url.json';
import fileUploadScenario from '../../../api/fixtures/scenarios/file-upload.json';

describe('instagram URL scenario', () => {
  it('returns correct title and block count', async () => {
    server.use(
      http.post('http://localhost:8004/ingest/ai_workout', () => HttpResponse.json(instagramScenario.mocks.ingestor)),
      http.post('http://localhost:8001/validate', () => HttpResponse.json(instagramScenario.mocks.mapper)),
    );
    const { workout } = await runIngestionPipeline(instagramScenario.input.sources);
    expect(workout.title).toBe(instagramScenario.expectedOutput.title);
    expect(workout.blocks).toHaveLength(instagramScenario.expectedOutput.blockCount);
  });

  it('returns correct exercise count', async () => {
    server.use(
      http.post('http://localhost:8004/ingest/ai_workout', () => HttpResponse.json(instagramScenario.mocks.ingestor)),
      http.post('http://localhost:8001/validate', () => HttpResponse.json(instagramScenario.mocks.mapper)),
    );
    const { workout } = await runIngestionPipeline(instagramScenario.input.sources);
    const totalExercises = workout.blocks.reduce((acc, b) => acc + (b.exercises?.length ?? 0), 0);
    expect(totalExercises).toBe(instagramScenario.expectedOutput.exerciseCount);
  });

  it('scenario mock data conforms to Zod schemas', () => {
    expect(() => WorkoutStructureResponseSchema.parse(instagramScenario.mocks.ingestor)).not.toThrow();
    expect(() => ValidationResponseSchema.parse(instagramScenario.mocks.mapper)).not.toThrow();
  });
});

describe('file upload scenario', () => {
  it('handles multi-block workout correctly', async () => {
    server.use(
      http.post('http://localhost:8004/ingest/ai_workout', () => HttpResponse.json(fileUploadScenario.mocks.ingestor)),
      http.post('http://localhost:8001/validate', () => HttpResponse.json(fileUploadScenario.mocks.mapper)),
    );
    const { workout } = await runIngestionPipeline(fileUploadScenario.input.sources);
    expect(workout.blocks).toHaveLength(fileUploadScenario.expectedOutput.blockCount);
    expect(workout.title).toBe(fileUploadScenario.expectedOutput.title);
  });

  it('scenario mock data conforms to Zod schemas', () => {
    expect(() => WorkoutStructureResponseSchema.parse(fileUploadScenario.mocks.ingestor)).not.toThrow();
    expect(() => ValidationResponseSchema.parse(fileUploadScenario.mocks.mapper)).not.toThrow();
  });
});
```

Also add these imports at the top of `ingestion.test.ts`:
```ts
import { WorkoutStructureResponseSchema } from '../../../api/schemas/ingestor';
import { ValidationResponseSchema } from '../../../api/schemas/mapper';
```

**Step 4: Run the pipeline tests**

```bash
npx vitest run src/lib/__tests__/pipelines/ --reporter=verbose
```

Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/api/fixtures/scenarios/ src/lib/__tests__/pipelines/ingestion.test.ts
git commit -m "feat: add scenario fixtures for instagram and file-upload ingestion flows"
```

---

### Task 6: Wire useWorkflowEditing to use runIngestionPipeline

**Context:** `src/app/hooks/useWorkflowEditing.ts` currently calls `generateWorkoutStructure` and `validateExercises` via scattered imports or through the old `src/lib/api.ts`. After this task, it calls `runIngestionPipeline` instead — a single call that handles sequencing and throws `PipelineError` on failure. The UI catches `PipelineError` and shows the `code` and `detail` to the user rather than crashing.

**Files:**
- Read first: `src/app/hooks/useWorkflowEditing.ts` (find where ingestor/mapper are called)
- Read first: any other hooks in `src/app/hooks/` that call the ingestor directly
- Modify: whichever hook actually calls `generateWorkoutStructure`

**Step 1: Find where generateWorkoutStructure is called**

```bash
grep -r "generateWorkoutStructure\|import.*from.*lib/api" src/app src/hooks --include="*.ts" --include="*.tsx" -l
```

Read each file found. The goal is to find the call site that does:
1. `generateWorkoutStructure(sources)`
2. followed by any mapper/validation call

**Step 2: Replace the scattered calls with runIngestionPipeline**

In whichever hook calls these, replace:

```ts
// OLD (example — actual code may differ)
const workout = await generateWorkoutStructure(sources, signal);
const validation = await validateExercises(workout);
```

With:

```ts
// NEW
import { runIngestionPipeline } from '../../api/pipelines/ingestion';
import { PipelineError } from '../../api/pipelines';

// inside the async function:
try {
  const { workout, validation } = await runIngestionPipeline(sources, signal);
  setWorkout(workout);
  setValidation(validation);
} catch (err) {
  if (err instanceof PipelineError && err.code === 'UnmappedExercises') {
    toast.error(`Some exercises couldn't be mapped: ${(err.detail.unmapped as string[]).join(', ')}`);
  } else if (err instanceof PipelineError) {
    toast.error(err.message);
  } else {
    toast.error('Workout generation failed. Please try again.');
  }
}
```

**Important:** Do not remove the `import { generateWorkoutStructure } from '../../lib/api'` if it is used elsewhere in the same file. Only replace the specific call site.

**Step 3: Run the existing hook tests to verify nothing broke**

```bash
npx vitest run src/app/hooks/__tests__/ --reporter=verbose
```

If any test fails because it was mocking `generateWorkoutStructure` from `lib/api` directly, update the mock to target `api/pipelines/ingestion` instead:

```ts
// OLD mock in hook test
vi.mock('../../lib/api', () => ({ generateWorkoutStructure: vi.fn() }));

// NEW mock in hook test
vi.mock('../../api/pipelines/ingestion', () => ({
  runIngestionPipeline: vi.fn().mockResolvedValue({
    workout: { title: 'Test', blocks: [] },
    validation: { success: true, matches: [], unmapped: [] },
  }),
}));
```

**Step 4: Run the full test suite**

```bash
npx vitest run --reporter=dot 2>&1 | tail -10
```

Expected: All tests pass (0 failures).

**Step 5: Commit**

```bash
git add src/app/hooks/useWorkflowEditing.ts  # (or whichever file was modified)
git commit -m "refactor: route ingestion through runIngestionPipeline with typed error handling"
```

---

### Task 7: Add vitest.config pipeline exclusions and npm scripts

**Context:** Pipeline tests use `msw/node` for HTTP interception. They're fast but slightly more involved than pure unit tests. We want them included in `npm test` (unlike contract tests which hit real backends). We also want `npm run test:pipelines` for running just the pipeline tests. Update `package.json` scripts.

**Files:**
- Read first: `package.json` (find existing test scripts)
- Modify: `package.json`

**Step 1: Read current test scripts**

```bash
cat package.json | grep -A 20 '"scripts"'
```

**Step 2: Add test:pipelines script**

In `package.json`, add alongside existing scripts:

```json
"test:pipelines": "vitest run src/lib/__tests__/pipelines/",
"test:fixtures": "vitest run src/lib/__tests__/fixtures.test.ts"
```

**Step 3: Verify the scripts run correctly**

```bash
npm run test:pipelines
npm run test:fixtures
```

Expected: Both pass.

**Step 4: Run the complete test suite one final time**

```bash
npx vitest run --reporter=dot 2>&1 | tail -15
```

Expected: All tests pass. Pipeline tests and fixture tests are included.

**Step 5: Commit**

```bash
git add package.json
git commit -m "chore: add test:pipelines and test:fixtures npm scripts"
```

---

## Done State

- `src/api/pipelines/index.ts` — `PipelineError` class
- `src/api/pipelines/ingestion.ts` — `runIngestionPipeline(sources, signal?)`
- `src/api/fixtures/services/*.json` — one valid response per service, all passing Zod parse
- `src/api/fixtures/scenarios/*.json` — instagram-url, file-upload scenarios
- `src/lib/__tests__/pipelines/pipeline-error.test.ts` — 4 tests
- `src/lib/__tests__/pipelines/ingestion.test.ts` — 5 base tests + 5 scenario tests
- `src/lib/__tests__/fixtures.test.ts` — one Zod parse test per service fixture
- `useWorkflowEditing` calls `runIngestionPipeline` — no direct ingestor/mapper imports
- `npm test` — 0 failures (8 pre-existing failures fixed in Task 1)
- `npm run test:pipelines` — runs pipeline integration tests only
- `npm run test:fixtures` — runs schema drift detection only

## What This Catches Going Forward

| Failure mode | Caught by |
|---|---|
| Backend changes shape of ingestor response | `fixtures.test.ts` — Zod parse fails |
| MSW mock drifts from real API | `fixtures.test.ts` — mock data parsed against schema |
| Ingestor + mapper compose incorrectly | `ingestion.test.ts` — full pipeline asserted |
| Exercises unmapped but UI doesn't show error | `ingestion.test.ts` — PipelineError test |
| New source type (Strava activity) breaks flow | Add scenario fixture → add test |
