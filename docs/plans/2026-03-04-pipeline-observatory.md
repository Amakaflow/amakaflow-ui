# Pipeline Observatory Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A standalone developer tool at `http://localhost:3000/pipeline.html` that lets David (or an agent) trigger full AI workout pipelines step-by-step, observe every API call's raw request/response/schema in real-time, intervene to edit data between steps in step-through mode, and review a full audit-trailed history of every run stored in IndexedDB.

**Architecture:** Separate Vite entry point (`pipeline.html` → `src/dev/pipeline/main.tsx`) so the tool has zero dependency on Clerk auth or AppShell. Core is a pure async generator (`pipelineRunner.ts`) that yields `StepEvent`s — the UI subscribes to these events; an MCP tool can also call the runner directly in future. Every step event is persisted to IndexedDB as it arrives (via `idb` library) so crashed runs still have partial traces. Three-panel layout: run history sidebar (left), pipeline canvas with Timeline/Steps/Raw tabs (center), step detail with request/response/schema (right). Step-through mode pauses after each step and renders an editable form; the run stores both `apiOutput` (raw) and `effectiveOutput` (possibly edited) for audit.

**Tech Stack:** React 18, TypeScript, Vite (separate entry), shadcn/ui (reused from main app), Tailwind CSS, Zod (existing schemas), `idb` (IndexedDB wrapper, new dependency), Vitest

---

## Existing Code Context

Read before starting:
- `src/api/schemas/ingestor.ts` — `WorkoutStructureSchema`, `ExerciseSchema`, `BlockSchema`
- `src/api/schemas/mapper.ts` — `ValidationResponseSchema`, `ExerciseMatchSchema`
- `src/lib/config.ts` — `API_URLS` (all 6 service base URLs)
- `src/lib/__tests__/contracts/ingestor.contract.test.ts` — how the ingestor is called (text/plain body)
- `src/lib/__tests__/contracts/mapper.contract.test.ts` — how the mapper is called (`{ exercises: string[] }`)
- `vite.config.ts` — Vite config to understand the build setup (needs a second entry point added)
- `src/components/ui/` — shadcn components available: `button`, `card`, `badge`, `tabs`, `scroll-area`, `textarea`, `separator`, `skeleton`, `tooltip`, `badge`, `sheet`, `select`

---

## Task 1: Install idb + Create Types

**Files:**
- Run: `npm install idb`
- Create: `src/dev/pipeline/store/runTypes.ts`

**Step 1: Install idb**

```bash
npm install idb
```

Expected: `idb` appears in `package.json` dependencies.

**Step 2: Create the type definitions**

Create `src/dev/pipeline/store/runTypes.ts`:

```ts
export type ServiceName = 'ingestor' | 'mapper' | 'garmin' | 'strava' | 'calendar' | 'chat';

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'paused';

export type RunStatus = 'running' | 'success' | 'failed' | 'cancelled' | 'paused';

export type FlowId = 'full-pipeline' | 'ingest-only' | 'map-only' | 'export-only' | 'health-check';

export type RunMode = 'auto' | 'step-through';

export interface SchemaValidationResult {
  passed: boolean;
  errors?: Array<{ path: string; message: string }>;
}

export interface PipelineStep {
  id: string;
  service: ServiceName;
  label: string;
  status: StepStatus;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  request?: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: unknown;
  };
  response?: {
    status: number;
    body: unknown;
  };
  schemaValidation?: SchemaValidationResult;
  error?: string;
  // Audit trail: both the raw API output and what actually went to the next step
  apiOutput?: unknown;
  effectiveOutput?: unknown;
  edited: boolean;
  editedAt?: number;
}

export interface PipelineRun {
  id: string;
  flowId: FlowId;
  label: string;
  mode: RunMode;
  status: RunStatus;
  startedAt: number;
  completedAt?: number;
  inputs: Record<string, unknown>;
  steps: PipelineStep[];
}

// Events emitted by pipelineRunner
export type StepEvent =
  | { type: 'run:started'; runId: string; flowId: FlowId; inputs: Record<string, unknown> }
  | { type: 'step:started'; runId: string; stepId: string; service: ServiceName; label: string }
  | { type: 'step:completed'; runId: string; stepId: string; step: PipelineStep }
  | { type: 'step:failed'; runId: string; stepId: string; error: string; step: PipelineStep }
  | { type: 'step:paused'; runId: string; stepId: string; step: PipelineStep }
  | { type: 'step:edited'; runId: string; stepId: string; effectiveOutput: unknown }
  | { type: 'run:completed'; runId: string; status: RunStatus }
  | { type: 'run:cancelled'; runId: string };
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "runTypes" | head -5
```

Expected: no errors from `runTypes.ts`.

**Step 4: Commit**

```bash
git add package.json package-lock.json src/dev/pipeline/store/runTypes.ts
git commit -m "feat(observatory): install idb and define pipeline run types"
```

---

## Task 2: Schema Validator (with tests)

**Files:**
- Create: `src/dev/pipeline/runner/schemaValidator.ts`
- Create: `src/dev/pipeline/runner/__tests__/schemaValidator.test.ts`

**Step 1: Write the failing test**

Create `src/dev/pipeline/runner/__tests__/schemaValidator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateAgainstSchema } from '../schemaValidator';
import { WorkoutStructureSchema } from '../../../../api/schemas/ingestor';
import { ValidationResponseSchema } from '../../../../api/schemas/mapper';

describe('validateAgainstSchema', () => {
  it('returns passed:true for valid ingestor response', () => {
    const data = { title: 'Test', blocks: [] };
    const result = validateAgainstSchema(data, WorkoutStructureSchema);
    expect(result.passed).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('returns passed:false with field errors for invalid data', () => {
    const data = { title: 123, blocks: 'not-an-array' }; // wrong types
    const result = validateAgainstSchema(data, WorkoutStructureSchema);
    expect(result.passed).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
    expect(result.errors![0]).toHaveProperty('path');
    expect(result.errors![0]).toHaveProperty('message');
  });

  it('returns passed:true for valid mapper ValidationResponse', () => {
    const data = { success: true, matches: [], unmapped: [] };
    const result = validateAgainstSchema(data, ValidationResponseSchema);
    expect(result.passed).toBe(true);
  });

  it('returns passed:false with path for missing required field', () => {
    const data = { success: true }; // missing matches and unmapped
    const result = validateAgainstSchema(data, ValidationResponseSchema);
    expect(result.passed).toBe(false);
    expect(result.errors!.some(e => e.path.includes('matches'))).toBe(true);
  });

  it('handles non-Zod errors gracefully', () => {
    const result = validateAgainstSchema(undefined, WorkoutStructureSchema);
    expect(result.passed).toBe(false);
    expect(result.errors).toBeDefined();
  });
});
```

**Step 2: Run to verify it fails**

```bash
npx vitest run src/dev/pipeline/runner/__tests__/schemaValidator.test.ts 2>&1 | tail -5
```

Expected: FAIL with "Cannot find module '../schemaValidator'"

**Step 3: Implement**

Create `src/dev/pipeline/runner/schemaValidator.ts`:

```ts
import { z } from 'zod';
import type { SchemaValidationResult } from '../store/runTypes';

export function validateAgainstSchema(
  data: unknown,
  schema: z.ZodTypeAny
): SchemaValidationResult {
  const result = schema.safeParse(data);
  if (result.success) {
    return { passed: true };
  }
  return {
    passed: false,
    errors: result.error.issues.map(issue => ({
      path: issue.path.join('.') || '(root)',
      message: issue.message,
    })),
  };
}
```

**Step 4: Run to verify it passes**

```bash
npx vitest run src/dev/pipeline/runner/__tests__/schemaValidator.test.ts 2>&1 | tail -5
```

Expected: 5 tests pass.

**Step 5: Commit**

```bash
git add src/dev/pipeline/runner/schemaValidator.ts src/dev/pipeline/runner/__tests__/schemaValidator.test.ts
git commit -m "feat(observatory): add schema validator with tests"
```

---

## Task 3: Step Executors

**Files:**
- Create: `src/dev/pipeline/runner/stepExecutors.ts`

No unit tests here — these make real HTTP calls. They're tested end-to-end when the observatory runs.

**Step 1: Create step executors**

Create `src/dev/pipeline/runner/stepExecutors.ts`:

```ts
import { API_URLS } from '../../../lib/config';
import { WorkoutStructureSchema } from '../../../api/schemas/ingestor';
import { ValidationResponseSchema } from '../../../api/schemas/mapper';
import { validateAgainstSchema } from './schemaValidator';
import type { PipelineStep, ServiceName, SchemaValidationResult } from '../store/runTypes';

const TEST_USER_ID = 'observatory-test';

interface ExecuteResult {
  request: PipelineStep['request'];
  response: PipelineStep['response'];
  schemaValidation?: SchemaValidationResult;
  apiOutput: unknown;
  error?: string;
}

export async function executeIngest(workoutText: string): Promise<ExecuteResult> {
  const url = `${API_URLS.INGESTOR}/ingest/ai_workout`;
  const request: PipelineStep['request'] = {
    url,
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', 'x-test-user-id': TEST_USER_ID },
    body: workoutText,
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: request.headers,
      body: workoutText,
      signal: AbortSignal.timeout(30000),
    });
    const body = await res.json();
    const schemaValidation = validateAgainstSchema(body, WorkoutStructureSchema);
    return {
      request,
      response: { status: res.status, body },
      schemaValidation,
      apiOutput: body,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return { request, response: undefined, apiOutput: undefined, error: String(err) };
  }
}

export async function executeMap(exercises: string[]): Promise<ExecuteResult> {
  const url = `${API_URLS.MAPPER}/validate`;
  const bodyPayload = { exercises };
  const request: PipelineStep['request'] = {
    url,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-user-id': TEST_USER_ID },
    body: bodyPayload,
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json();
    const schemaValidation = validateAgainstSchema(body, ValidationResponseSchema);
    return {
      request,
      response: { status: res.status, body },
      schemaValidation,
      apiOutput: body,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return { request, response: undefined, apiOutput: undefined, error: String(err) };
  }
}

export async function executeHealthCheck(service: ServiceName, baseUrl: string): Promise<ExecuteResult> {
  const url = `${baseUrl}/health`;
  const request: PipelineStep['request'] = {
    url,
    method: 'GET',
    headers: {},
    body: undefined,
  };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const body = await res.json().catch(() => ({}));
    return {
      request,
      response: { status: res.status, body },
      apiOutput: body,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return { request, response: undefined, apiOutput: undefined, error: String(err) };
  }
}

// Extract exercise names from an ingested workout structure
export function extractExerciseNames(workoutStructure: unknown): string[] {
  if (!workoutStructure || typeof workoutStructure !== 'object') return [];
  const ws = workoutStructure as Record<string, unknown>;
  const blocks = Array.isArray(ws.blocks) ? ws.blocks : [];
  const names: string[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const exercises = Array.isArray((block as Record<string, unknown>).exercises)
      ? (block as Record<string, unknown>).exercises as unknown[]
      : [];
    for (const ex of exercises) {
      if (ex && typeof ex === 'object' && typeof (ex as Record<string, unknown>).name === 'string') {
        names.push((ex as Record<string, unknown>).name as string);
      }
    }
  }
  return names;
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "stepExecutors" | head -5
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/dev/pipeline/runner/stepExecutors.ts
git commit -m "feat(observatory): add step executors for ingestor and mapper"
```

---

## Task 4: Pipeline Runner (with tests)

**Files:**
- Create: `src/dev/pipeline/runner/pipelineRunner.ts`
- Create: `src/dev/pipeline/runner/__tests__/pipelineRunner.test.ts`

**Step 1: Write the failing test**

Create `src/dev/pipeline/runner/__tests__/pipelineRunner.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPipeline, type PipelineRunnerOptions } from '../pipelineRunner';

// Mock the executors so we don't make real HTTP calls
vi.mock('../stepExecutors', () => ({
  executeIngest: vi.fn().mockResolvedValue({
    request: { url: 'http://localhost:8004/ingest/ai_workout', method: 'POST', headers: {}, body: 'bench press' },
    response: { status: 200, body: { title: 'Test Workout', blocks: [{ label: 'Block 1', exercises: [{ name: 'bench press' }] }] } },
    schemaValidation: { passed: true },
    apiOutput: { title: 'Test Workout', blocks: [{ label: 'Block 1', exercises: [{ name: 'bench press' }] }] },
  }),
  executeMap: vi.fn().mockResolvedValue({
    request: { url: 'http://localhost:8001/validate', method: 'POST', headers: {}, body: {} },
    response: { status: 200, body: { success: true, matches: [{ original_name: 'bench press', matched_name: 'Bench Press', confidence: 0.99, garmin_id: '123' }], unmapped: [] } },
    schemaValidation: { passed: true },
    apiOutput: { success: true, matches: [], unmapped: [] },
  }),
  executeHealthCheck: vi.fn().mockResolvedValue({
    request: { url: 'http://localhost:8004/health', method: 'GET', headers: {}, body: undefined },
    response: { status: 200, body: { status: 'ok' } },
    apiOutput: { status: 'ok' },
  }),
  extractExerciseNames: vi.fn().mockReturnValue(['bench press']),
}));

async function collectEvents(gen: AsyncGenerator<import('../../store/runTypes').StepEvent>) {
  const events: import('../../store/runTypes').StepEvent[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}

describe('runPipeline', () => {
  it('yields run:started and run:completed events for ingest-only flow', async () => {
    const events = await collectEvents(
      runPipeline({ flowId: 'ingest-only', inputs: { workoutText: 'bench press 3x10' }, mode: 'auto' })
    );
    expect(events[0].type).toBe('run:started');
    expect(events.at(-1)!.type).toBe('run:completed');
  });

  it('yields step:started and step:completed for each step', async () => {
    const events = await collectEvents(
      runPipeline({ flowId: 'ingest-only', inputs: { workoutText: 'bench press' }, mode: 'auto' })
    );
    const started = events.filter(e => e.type === 'step:started');
    const completed = events.filter(e => e.type === 'step:completed');
    expect(started.length).toBe(1);
    expect(completed.length).toBe(1);
  });

  it('yields step:failed when executor returns an error', async () => {
    const { executeIngest } = await import('../stepExecutors');
    vi.mocked(executeIngest).mockResolvedValueOnce({
      request: { url: 'x', method: 'POST', headers: {}, body: '' },
      response: undefined,
      apiOutput: undefined,
      error: 'Network error',
    });
    const events = await collectEvents(
      runPipeline({ flowId: 'ingest-only', inputs: { workoutText: 'bench press' }, mode: 'auto' })
    );
    const failed = events.find(e => e.type === 'step:failed');
    expect(failed).toBeDefined();
  });

  it('full-pipeline flow yields ingest + map steps', async () => {
    const events = await collectEvents(
      runPipeline({ flowId: 'full-pipeline', inputs: { workoutText: 'bench press', exportTarget: 'garmin' }, mode: 'auto' })
    );
    const stepLabels = events
      .filter(e => e.type === 'step:started')
      .map(e => (e as Extract<typeof e, { type: 'step:started' }>).service);
    expect(stepLabels).toContain('ingestor');
    expect(stepLabels).toContain('mapper');
  });
});
```

**Step 2: Run to verify it fails**

```bash
npx vitest run src/dev/pipeline/runner/__tests__/pipelineRunner.test.ts 2>&1 | tail -5
```

Expected: FAIL with "Cannot find module '../pipelineRunner'"

**Step 3: Implement**

Create `src/dev/pipeline/runner/pipelineRunner.ts`:

```ts
import { v4 as uuidv4 } from 'crypto';
import type { FlowId, RunMode, StepEvent, PipelineStep, ServiceName } from '../store/runTypes';
import { executeIngest, executeMap, executeHealthCheck, extractExerciseNames } from './stepExecutors';
import { API_URLS } from '../../../lib/config';

// crypto.randomUUID is available in modern browsers
function genId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export interface PipelineRunnerOptions {
  flowId: FlowId;
  inputs: Record<string, unknown>;
  mode: RunMode;
  // In step-through mode, when paused the runner awaits this promise before continuing.
  // The resolved value is the (possibly edited) effective output.
  onStepPaused?: (stepId: string, step: PipelineStep) => Promise<unknown>;
}

export async function* runPipeline(opts: PipelineRunnerOptions): AsyncGenerator<StepEvent> {
  const { flowId, inputs, mode, onStepPaused } = opts;
  const runId = genId();

  yield { type: 'run:started', runId, flowId, inputs };

  try {
    if (flowId === 'ingest-only') {
      yield* runIngestStep(runId, inputs.workoutText as string, mode, onStepPaused);
    } else if (flowId === 'map-only') {
      yield* runMapStep(runId, inputs.exercises as string[], mode, onStepPaused);
    } else if (flowId === 'full-pipeline') {
      // Step 1: Ingest
      let ingestOutput: unknown;
      for await (const event of runIngestStep(runId, inputs.workoutText as string, mode, onStepPaused)) {
        yield event;
        if (event.type === 'step:completed') ingestOutput = event.step.effectiveOutput;
        if (event.type === 'step:failed') {
          yield { type: 'run:completed', runId, status: 'failed' };
          return;
        }
      }
      // Step 2: Map (extract exercises from ingest output)
      const exercises = extractExerciseNames(ingestOutput);
      let mapOutput: unknown;
      for await (const event of runMapStep(runId, exercises, mode, onStepPaused)) {
        yield event;
        if (event.type === 'step:completed') mapOutput = event.step.effectiveOutput;
        if (event.type === 'step:failed') {
          yield { type: 'run:completed', runId, status: 'failed' };
          return;
        }
      }
      void mapOutput; // export step will use this in a future task
    } else if (flowId === 'health-check') {
      yield* runHealthCheckSteps(runId);
    }

    yield { type: 'run:completed', runId, status: 'success' };
  } catch (err) {
    yield { type: 'run:completed', runId, status: 'failed' };
  }
}

async function* runIngestStep(
  runId: string,
  workoutText: string,
  mode: RunMode,
  onStepPaused?: PipelineRunnerOptions['onStepPaused']
): AsyncGenerator<StepEvent> {
  const stepId = genId();
  const service: ServiceName = 'ingestor';
  yield { type: 'step:started', runId, stepId, service, label: 'Ingest workout text' };

  const result = await executeIngest(workoutText);
  const step: PipelineStep = {
    id: stepId,
    service,
    label: 'Ingest workout text',
    status: result.error ? 'failed' : 'success',
    request: result.request,
    response: result.response,
    schemaValidation: result.schemaValidation,
    apiOutput: result.apiOutput,
    effectiveOutput: result.apiOutput,
    edited: false,
  };

  if (result.error) {
    yield { type: 'step:failed', runId, stepId, error: result.error, step };
    return;
  }

  if (mode === 'step-through' && onStepPaused) {
    step.status = 'paused';
    yield { type: 'step:paused', runId, stepId, step };
    const effective = await onStepPaused(stepId, step);
    if (effective !== step.apiOutput) {
      step.edited = true;
      step.editedAt = Date.now();
      step.effectiveOutput = effective;
      yield { type: 'step:edited', runId, stepId, effectiveOutput: effective };
    }
    step.status = 'success';
  }

  yield { type: 'step:completed', runId, stepId, step };
}

async function* runMapStep(
  runId: string,
  exercises: string[],
  mode: RunMode,
  onStepPaused?: PipelineRunnerOptions['onStepPaused']
): AsyncGenerator<StepEvent> {
  const stepId = genId();
  const service: ServiceName = 'mapper';
  yield { type: 'step:started', runId, stepId, service, label: 'Map exercises' };

  const result = await executeMap(exercises);
  const step: PipelineStep = {
    id: stepId,
    service,
    label: 'Map exercises',
    status: result.error ? 'failed' : 'success',
    request: result.request,
    response: result.response,
    schemaValidation: result.schemaValidation,
    apiOutput: result.apiOutput,
    effectiveOutput: result.apiOutput,
    edited: false,
  };

  if (result.error) {
    yield { type: 'step:failed', runId, stepId, error: result.error, step };
    return;
  }

  if (mode === 'step-through' && onStepPaused) {
    step.status = 'paused';
    yield { type: 'step:paused', runId, stepId, step };
    const effective = await onStepPaused(stepId, step);
    if (effective !== step.apiOutput) {
      step.edited = true;
      step.editedAt = Date.now();
      step.effectiveOutput = effective;
      yield { type: 'step:edited', runId, stepId, effectiveOutput: effective };
    }
    step.status = 'success';
  }

  yield { type: 'step:completed', runId, stepId, step };
}

async function* runHealthCheckSteps(runId: string): AsyncGenerator<StepEvent> {
  const services: Array<{ name: ServiceName; url: string; label: string }> = [
    { name: 'ingestor', url: API_URLS.INGESTOR, label: 'Ingestor health' },
    { name: 'mapper', url: API_URLS.MAPPER, label: 'Mapper health' },
    { name: 'garmin', url: API_URLS.GARMIN, label: 'Garmin health' },
    { name: 'strava', url: API_URLS.STRAVA, label: 'Strava health' },
    { name: 'calendar', url: API_URLS.CALENDAR, label: 'Calendar health' },
    { name: 'chat', url: API_URLS.CHAT, label: 'Chat health' },
  ];
  for (const svc of services) {
    const stepId = genId();
    yield { type: 'step:started', runId, stepId, service: svc.name, label: svc.label };
    const result = await executeHealthCheck(svc.name, svc.url);
    const step: PipelineStep = {
      id: stepId,
      service: svc.name,
      label: svc.label,
      status: result.error ? 'failed' : 'success',
      request: result.request,
      response: result.response,
      apiOutput: result.apiOutput,
      effectiveOutput: result.apiOutput,
      edited: false,
    };
    if (result.error) {
      yield { type: 'step:failed', runId, stepId, error: result.error, step };
    } else {
      yield { type: 'step:completed', runId, stepId, step };
    }
  }
}
```

**Step 4: Run tests**

```bash
npx vitest run src/dev/pipeline/runner/__tests__/pipelineRunner.test.ts 2>&1 | tail -10
```

Expected: 4 tests pass.

**Step 5: Commit**

```bash
git add src/dev/pipeline/runner/pipelineRunner.ts src/dev/pipeline/runner/__tests__/pipelineRunner.test.ts
git commit -m "feat(observatory): add pipeline runner with step-through support"
```

---

## Task 5: IndexedDB Store

**Files:**
- Create: `src/dev/pipeline/store/runStore.ts`

**Step 1: Create the store**

Create `src/dev/pipeline/store/runStore.ts`:

```ts
import { openDB, type IDBPDatabase } from 'idb';
import type { PipelineRun, StepEvent } from './runTypes';

const DB_NAME = 'pipeline-observatory';
const DB_VERSION = 1;
const RUNS_STORE = 'runs';
const MAX_RUNS = 100;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(RUNS_STORE)) {
          const store = db.createObjectStore(RUNS_STORE, { keyPath: 'id' });
          store.createIndex('startedAt', 'startedAt');
        }
      },
    });
  }
  return dbPromise;
}

export async function saveRun(run: PipelineRun): Promise<void> {
  const db = await getDb();
  await db.put(RUNS_STORE, run);
  // Trim to MAX_RUNS
  const allKeys = await db.getAllKeysFromIndex(RUNS_STORE, 'startedAt');
  if (allKeys.length > MAX_RUNS) {
    const toDelete = allKeys.slice(0, allKeys.length - MAX_RUNS);
    const tx = db.transaction(RUNS_STORE, 'readwrite');
    await Promise.all(toDelete.map(k => tx.store.delete(k)));
    await tx.done;
  }
}

export async function getRun(id: string): Promise<PipelineRun | undefined> {
  const db = await getDb();
  return db.get(RUNS_STORE, id);
}

export async function getAllRuns(): Promise<PipelineRun[]> {
  const db = await getDb();
  const runs = await db.getAllFromIndex(RUNS_STORE, 'startedAt');
  return runs.reverse(); // newest first
}

export async function deleteRun(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(RUNS_STORE, id);
}

// Build a PipelineRun from a stream of StepEvents (called by usePipelineRunner hook)
export function applyEventToRun(run: PipelineRun, event: StepEvent): PipelineRun {
  switch (event.type) {
    case 'run:started':
      return { ...run, status: 'running', startedAt: Date.now() };
    case 'step:started':
      return {
        ...run,
        steps: [
          ...run.steps,
          { id: event.stepId, service: event.service, label: event.label, status: 'running', edited: false, startedAt: Date.now() },
        ],
      };
    case 'step:completed':
    case 'step:failed':
    case 'step:paused': {
      return {
        ...run,
        steps: run.steps.map(s => s.id === event.stepId ? { ...s, ...event.step } : s),
      };
    }
    case 'step:edited': {
      return {
        ...run,
        steps: run.steps.map(s =>
          s.id === event.stepId
            ? { ...s, effectiveOutput: event.effectiveOutput, edited: true, editedAt: Date.now() }
            : s
        ),
      };
    }
    case 'run:completed':
    case 'run:cancelled':
      return { ...run, status: event.type === 'run:completed' ? (event as { status: string }).status as PipelineRun['status'] : 'cancelled', completedAt: Date.now() };
    default:
      return run;
  }
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "runStore" | head -5
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/dev/pipeline/store/runStore.ts
git commit -m "feat(observatory): add IndexedDB store with 100-run history and audit trail"
```

---

## Task 6: React Hooks

**Files:**
- Create: `src/dev/pipeline/hooks/usePipelineRunner.ts`
- Create: `src/dev/pipeline/hooks/useRunHistory.ts`
- Create: `src/dev/pipeline/hooks/useServiceHealth.ts`

**Step 1: Create usePipelineRunner**

Create `src/dev/pipeline/hooks/usePipelineRunner.ts`:

```ts
import { useState, useRef, useCallback } from 'react';
import { runPipeline, type PipelineRunnerOptions } from '../runner/pipelineRunner';
import { saveRun, applyEventToRun } from '../store/runStore';
import type { PipelineRun, PipelineStep, FlowId, RunMode } from '../store/runTypes';

function emptyRun(flowId: FlowId, inputs: Record<string, unknown>, mode: RunMode): PipelineRun {
  return { id: '', flowId, label: flowId, mode, status: 'running', startedAt: Date.now(), inputs, steps: [] };
}

interface UsePipelineRunnerResult {
  activeRun: PipelineRun | null;
  isRunning: boolean;
  pausedStep: PipelineStep | null;
  start: (opts: PipelineRunnerOptions) => void;
  stop: () => void;
  continueWithEdit: (effectiveOutput: unknown) => void;
}

export function usePipelineRunner(onRunSaved: () => void): UsePipelineRunnerResult {
  const [activeRun, setActiveRun] = useState<PipelineRun | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [pausedStep, setPausedStep] = useState<PipelineStep | null>(null);
  const abortRef = useRef<boolean>(false);
  // resolveEdit is called when the user clicks "Continue" in step-through mode
  const resolveEditRef = useRef<((output: unknown) => void) | null>(null);

  const start = useCallback((opts: PipelineRunnerOptions) => {
    abortRef.current = false;
    setIsRunning(true);
    setPausedStep(null);

    const onStepPaused = opts.mode === 'step-through'
      ? async (_stepId: string, step: PipelineStep): Promise<unknown> => {
          setPausedStep(step);
          return new Promise<unknown>(resolve => { resolveEditRef.current = resolve; });
        }
      : undefined;

    const gen = runPipeline({ ...opts, onStepPaused });

    (async () => {
      let run = emptyRun(opts.flowId, opts.inputs, opts.mode);
      for await (const event of gen) {
        if (abortRef.current) break;
        if (event.type === 'run:started') run = { ...run, id: event.runId };
        run = applyEventToRun(run, event);
        setActiveRun({ ...run });
        if (event.type === 'run:completed' || event.type === 'run:cancelled') {
          await saveRun(run);
          onRunSaved();
        }
      }
      setIsRunning(false);
      setPausedStep(null);
    })();
  }, [onRunSaved]);

  const stop = useCallback(() => {
    abortRef.current = true;
    setIsRunning(false);
    setPausedStep(null);
    resolveEditRef.current = null;
  }, []);

  const continueWithEdit = useCallback((effectiveOutput: unknown) => {
    setPausedStep(null);
    resolveEditRef.current?.(effectiveOutput);
    resolveEditRef.current = null;
  }, []);

  return { activeRun, isRunning, pausedStep, start, stop, continueWithEdit };
}
```

**Step 2: Create useRunHistory**

Create `src/dev/pipeline/hooks/useRunHistory.ts`:

```ts
import { useState, useEffect, useCallback } from 'react';
import { getAllRuns, deleteRun } from '../store/runStore';
import type { PipelineRun } from '../store/runTypes';

export function useRunHistory() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);

  const refresh = useCallback(async () => {
    const all = await getAllRuns();
    setRuns(all);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await deleteRun(id);
    await refresh();
  }, [refresh]);

  return { runs, refresh, remove };
}
```

**Step 3: Create useServiceHealth**

Create `src/dev/pipeline/hooks/useServiceHealth.ts`:

```ts
import { useState, useEffect } from 'react';
import { API_URLS } from '../../../lib/config';
import type { ServiceName } from '../store/runTypes';

interface ServiceStatus {
  service: ServiceName;
  label: string;
  url: string;
  status: 'up' | 'down' | 'checking';
  latencyMs?: number;
}

const SERVICES: Array<{ service: ServiceName; label: string; url: string }> = [
  { service: 'ingestor', label: 'Ingestor', url: API_URLS.INGESTOR },
  { service: 'mapper', label: 'Mapper', url: API_URLS.MAPPER },
  { service: 'garmin', label: 'Garmin', url: API_URLS.GARMIN },
  { service: 'strava', label: 'Strava', url: API_URLS.STRAVA },
  { service: 'calendar', label: 'Calendar', url: API_URLS.CALENDAR },
  { service: 'chat', label: 'Chat', url: API_URLS.CHAT },
];

async function checkHealth(url: string): Promise<{ up: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
    return { up: res.ok, latencyMs: Date.now() - start };
  } catch {
    return { up: false, latencyMs: Date.now() - start };
  }
}

export function useServiceHealth(intervalMs = 30000) {
  const [statuses, setStatuses] = useState<ServiceStatus[]>(
    SERVICES.map(s => ({ ...s, status: 'checking' }))
  );

  const checkAll = async () => {
    const results = await Promise.all(
      SERVICES.map(async svc => {
        const { up, latencyMs } = await checkHealth(svc.url);
        return { ...svc, status: up ? 'up' as const : 'down' as const, latencyMs };
      })
    );
    setStatuses(results);
  };

  useEffect(() => {
    checkAll();
    const interval = setInterval(checkAll, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  return statuses;
}
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "(usePipeline|useRunHistory|useServiceHealth)" | head -5
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/dev/pipeline/hooks/
git commit -m "feat(observatory): add React hooks for pipeline runner, history, and service health"
```

---

## Task 7: UI Components — ServiceHealth + RunHistory

**Files:**
- Create: `src/dev/pipeline/components/ServiceHealth.tsx`
- Create: `src/dev/pipeline/components/RunHistory.tsx`

**Step 1: Create ServiceHealth**

Create `src/dev/pipeline/components/ServiceHealth.tsx`:

```tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../components/ui/tooltip';
import { Badge } from '../../../components/ui/badge';
import { useServiceHealth } from '../hooks/useServiceHealth';

export function ServiceHealth() {
  const statuses = useServiceHealth();

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground mr-1">Services:</span>
        {statuses.map(svc => (
          <Tooltip key={svc.service}>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-default">
                <div className={`w-2 h-2 rounded-full ${
                  svc.status === 'up' ? 'bg-green-500' :
                  svc.status === 'down' ? 'bg-red-500' :
                  'bg-yellow-400 animate-pulse'
                }`} />
                <span className="text-xs text-muted-foreground">{svc.label}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                {svc.url} — {svc.status === 'checking' ? 'checking...' : svc.status === 'up' ? `up (${svc.latencyMs}ms)` : `down`}
              </p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
```

**Step 2: Create RunHistory**

Create `src/dev/pipeline/components/RunHistory.tsx`:

```tsx
import { ScrollArea } from '../../../components/ui/scroll-area';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Trash2, Plus } from 'lucide-react';
import { useRunHistory } from '../hooks/useRunHistory';
import type { PipelineRun } from '../store/runTypes';

interface RunHistoryProps {
  selectedRunId: string | null;
  onSelectRun: (run: PipelineRun) => void;
  onNewRun: () => void;
  refreshTrigger: number; // increment to force refresh
}

const FLOW_LABELS: Record<string, string> = {
  'full-pipeline': 'Full Pipeline',
  'ingest-only': 'Ingest Only',
  'map-only': 'Map Only',
  'export-only': 'Export Only',
  'health-check': 'Health Check',
};

export function RunHistory({ selectedRunId, onSelectRun, onNewRun, refreshTrigger }: RunHistoryProps) {
  const { runs, refresh, remove } = useRunHistory();

  // Refresh when parent signals a new run was saved
  useEffect(() => { refresh(); }, [refreshTrigger, refresh]);

  return (
    <div className="flex flex-col h-full border-r">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-semibold">Run History</span>
        <Button size="sm" variant="ghost" onClick={onNewRun} className="h-7 w-7 p-0">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {runs.length === 0 && (
          <p className="text-xs text-muted-foreground p-3">No runs yet. Start a new run.</p>
        )}
        {runs.map(run => (
          <div
            key={run.id}
            onClick={() => onSelectRun(run)}
            className={`group flex items-start justify-between px-3 py-2 cursor-pointer hover:bg-muted/50 border-b ${
              selectedRunId === run.id ? 'bg-muted' : ''
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Badge variant={run.status === 'success' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px] px-1 py-0 h-4">
                  {run.status}
                </Badge>
                <span className="text-xs font-medium truncate">{FLOW_LABELS[run.flowId] ?? run.flowId}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {new Date(run.startedAt).toLocaleTimeString()}
                {run.completedAt && ` · ${run.completedAt - run.startedAt}ms`}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 shrink-0"
              onClick={e => { e.stopPropagation(); remove(run.id); }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}
```

Note: add `import { useEffect } from 'react';` at the top of RunHistory.tsx.

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "(ServiceHealth|RunHistory)" | head -5
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/dev/pipeline/components/ServiceHealth.tsx src/dev/pipeline/components/RunHistory.tsx
git commit -m "feat(observatory): add ServiceHealth bar and RunHistory sidebar"
```

---

## Task 8: UI Components — StepCard + StepDetail

**Files:**
- Create: `src/dev/pipeline/components/StepCard.tsx`
- Create: `src/dev/pipeline/components/StepDetail.tsx`

**Step 1: Create StepCard**

Create `src/dev/pipeline/components/StepCard.tsx`:

```tsx
import { CheckCircle2, XCircle, Loader2, Pause, Clock } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import type { PipelineStep } from '../store/runTypes';

interface StepCardProps {
  step: PipelineStep;
  isSelected: boolean;
  onClick: () => void;
}

const SERVICE_COLORS: Record<string, string> = {
  ingestor: 'bg-blue-500/10 border-blue-500/30 text-blue-700',
  mapper: 'bg-purple-500/10 border-purple-500/30 text-purple-700',
  garmin: 'bg-green-500/10 border-green-500/30 text-green-700',
  strava: 'bg-orange-500/10 border-orange-500/30 text-orange-700',
  calendar: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700',
  chat: 'bg-pink-500/10 border-pink-500/30 text-pink-700',
};

function StatusIcon({ status }: { status: PipelineStep['status'] }) {
  if (status === 'success') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-red-500" />;
  if (status === 'running') return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
  if (status === 'paused') return <Pause className="h-4 w-4 text-yellow-500" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

export function StepCard({ step, isSelected, onClick }: StepCardProps) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
        isSelected ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
      } ${SERVICE_COLORS[step.service] ?? 'bg-muted/30 border-border'}`}
    >
      <StatusIcon status={step.status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{step.label}</p>
        <p className="text-xs text-muted-foreground capitalize">{step.service}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        {step.durationMs !== undefined && (
          <span className="text-[10px] text-muted-foreground">{step.durationMs}ms</span>
        )}
        {step.edited && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-3.5">edited</Badge>
        )}
        {step.schemaValidation && (
          <Badge
            variant={step.schemaValidation.passed ? 'default' : 'destructive'}
            className="text-[10px] px-1 py-0 h-3.5"
          >
            {step.schemaValidation.passed ? 'schema ✓' : 'schema ✗'}
          </Badge>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Create StepDetail**

Create `src/dev/pipeline/components/StepDetail.tsx`:

```tsx
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
import { Badge } from '../../../components/ui/badge';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { Separator } from '../../../components/ui/separator';
import type { PipelineStep } from '../store/runTypes';

interface StepDetailProps {
  step: PipelineStep;
}

function JsonView({ data }: { data: unknown }) {
  return (
    <pre className="text-xs font-mono whitespace-pre-wrap break-all p-3 bg-muted/30 rounded-md">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export function StepDetail({ step }: StepDetailProps) {
  const [view, setView] = useState<'request' | 'response' | 'schema' | 'audit'>('response');

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm capitalize">{step.service}</span>
          <Badge variant={step.status === 'success' ? 'default' : step.status === 'failed' ? 'destructive' : 'secondary'}>
            {step.status}
          </Badge>
          {step.edited && <Badge variant="outline" className="text-xs">edited</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{step.label}</p>
        {step.durationMs !== undefined && (
          <p className="text-xs text-muted-foreground mt-0.5">{step.durationMs}ms</p>
        )}
      </div>

      <Tabs value={view} onValueChange={v => setView(v as typeof view)} className="flex flex-col flex-1 min-h-0">
        <TabsList className="mx-4 mt-3 w-fit">
          <TabsTrigger value="response" className="text-xs">Response</TabsTrigger>
          <TabsTrigger value="request" className="text-xs">Request</TabsTrigger>
          <TabsTrigger value="schema" className="text-xs">
            Schema {step.schemaValidation ? (step.schemaValidation.passed ? '✓' : '✗') : ''}
          </TabsTrigger>
          {step.edited && <TabsTrigger value="audit" className="text-xs">Audit</TabsTrigger>}
        </TabsList>

        <ScrollArea className="flex-1 px-4 pb-4">
          <TabsContent value="response" className="mt-3">
            {step.response ? (
              <>
                <Badge variant={step.response.status < 400 ? 'default' : 'destructive'} className="mb-2">
                  HTTP {step.response.status}
                </Badge>
                <JsonView data={step.response.body} />
              </>
            ) : (
              <p className="text-xs text-muted-foreground">No response — {step.error ?? 'pending'}</p>
            )}
            {step.error && (
              <div className="mt-2 p-2 bg-destructive/10 text-destructive rounded text-xs">{step.error}</div>
            )}
          </TabsContent>

          <TabsContent value="request" className="mt-3">
            {step.request ? (
              <>
                <p className="text-xs font-mono mb-2">
                  <span className="font-bold">{step.request.method}</span>{' '}
                  {step.request.url}
                </p>
                <JsonView data={step.request.body} />
              </>
            ) : (
              <p className="text-xs text-muted-foreground">No request recorded</p>
            )}
          </TabsContent>

          <TabsContent value="schema" className="mt-3">
            {step.schemaValidation ? (
              step.schemaValidation.passed ? (
                <p className="text-xs text-green-600 font-medium">✓ Schema validation passed</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-red-600 font-medium">✗ Schema validation failed</p>
                  {step.schemaValidation.errors?.map((err, i) => (
                    <div key={i} className="text-xs p-2 bg-destructive/10 rounded">
                      <span className="font-mono text-destructive">{err.path}</span>
                      <span className="text-muted-foreground ml-2">{err.message}</span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <p className="text-xs text-muted-foreground">No schema validation for this step</p>
            )}
          </TabsContent>

          <TabsContent value="audit" className="mt-3">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold mb-1 text-muted-foreground">API returned:</p>
                <JsonView data={step.apiOutput} />
              </div>
              <Separator />
              <div>
                <p className="text-xs font-semibold mb-1 text-muted-foreground">Sent to next step:</p>
                <JsonView data={step.effectiveOutput} />
              </div>
              {step.editedAt && (
                <p className="text-xs text-muted-foreground">Edited at {new Date(step.editedAt).toLocaleTimeString()}</p>
              )}
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "(StepCard|StepDetail)" | head -5
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/dev/pipeline/components/StepCard.tsx src/dev/pipeline/components/StepDetail.tsx
git commit -m "feat(observatory): add StepCard and StepDetail components"
```

---

## Task 9: StepEditForm (step-through mode)

**Files:**
- Create: `src/dev/pipeline/components/StepEditForm.tsx`

This component renders when the pipeline is paused in step-through mode. It shows the step's output as editable JSON (textarea) with a Continue button. Future: swap textarea for structured form fields.

**Step 1: Create StepEditForm**

Create `src/dev/pipeline/components/StepEditForm.tsx`:

```tsx
import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { Badge } from '../../../components/ui/badge';
import { Play, X } from 'lucide-react';
import type { PipelineStep } from '../store/runTypes';

interface StepEditFormProps {
  step: PipelineStep;
  onContinue: (effectiveOutput: unknown) => void;
  onAbort: () => void;
}

export function StepEditForm({ step, onContinue, onAbort }: StepEditFormProps) {
  const [json, setJson] = useState(JSON.stringify(step.apiOutput, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);

  function handleContinue() {
    try {
      const parsed = JSON.parse(json);
      setParseError(null);
      onContinue(parsed);
    } catch {
      setParseError('Invalid JSON — fix before continuing');
    }
  }

  function handleSkipEdit() {
    onContinue(step.apiOutput);
  }

  return (
    <div className="flex flex-col gap-3 p-4 border rounded-lg bg-yellow-500/5 border-yellow-500/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-yellow-500 text-yellow-700">⏸ Paused</Badge>
          <span className="text-sm font-medium">{step.label}</span>
        </div>
        <span className="text-xs text-muted-foreground capitalize">{step.service}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Edit the output before it's sent to the next step. Changes are recorded in the audit trail.
      </p>
      <Textarea
        value={json}
        onChange={e => { setJson(e.target.value); setParseError(null); }}
        className="font-mono text-xs min-h-[200px]"
        spellCheck={false}
      />
      {parseError && (
        <p className="text-xs text-destructive">{parseError}</p>
      )}
      <div className="flex gap-2">
        <Button onClick={handleContinue} size="sm" className="flex-1">
          <Play className="h-3.5 w-3.5 mr-1.5" />
          Continue with edits
        </Button>
        <Button onClick={handleSkipEdit} size="sm" variant="outline">
          Continue as-is
        </Button>
        <Button onClick={onAbort} size="sm" variant="ghost" className="text-destructive">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/dev/pipeline/components/StepEditForm.tsx
git commit -m "feat(observatory): add StepEditForm for step-through mode intervention"
```

---

## Task 10: PipelineCanvas (center panel)

**Files:**
- Create: `src/dev/pipeline/components/PipelineCanvas.tsx`

**Step 1: Create PipelineCanvas**

Create `src/dev/pipeline/components/PipelineCanvas.tsx`:

```tsx
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Badge } from '../../../components/ui/badge';
import { Play, Square, RotateCcw } from 'lucide-react';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { StepCard } from './StepCard';
import { StepDetail } from './StepDetail';
import { StepEditForm } from './StepEditForm';
import { usePipelineRunner } from '../hooks/usePipelineRunner';
import type { PipelineRun, FlowId, RunMode } from '../store/runTypes';

interface PipelineCanvasProps {
  replayRun?: PipelineRun | null;
  onRunSaved: () => void;
}

export function PipelineCanvas({ replayRun, onRunSaved }: PipelineCanvasProps) {
  const { activeRun, isRunning, pausedStep, start, stop, continueWithEdit } = usePipelineRunner(onRunSaved);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [flowId, setFlowId] = useState<FlowId>('ingest-only');
  const [mode, setMode] = useState<RunMode>('auto');
  const [workoutText, setWorkoutText] = useState('bench press 3x10, overhead press 3x8, squat 3x8');
  const [view, setView] = useState<'steps' | 'raw'>('steps');

  const run = activeRun ?? replayRun;
  const selectedStep = run?.steps.find(s => s.id === selectedStepId) ?? null;

  function handleStart() {
    setSelectedStepId(null);
    start({
      flowId,
      inputs: { workoutText, exportTarget: 'garmin' },
      mode,
    });
  }

  function handleReplay() {
    if (!replayRun) return;
    setSelectedStepId(null);
    start({
      flowId: replayRun.flowId,
      inputs: replayRun.inputs,
      mode,
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="px-4 py-3 border-b space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={flowId} onValueChange={v => setFlowId(v as FlowId)}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ingest-only">Ingest Only</SelectItem>
              <SelectItem value="map-only">Map Only</SelectItem>
              <SelectItem value="full-pipeline">Full Pipeline</SelectItem>
              <SelectItem value="health-check">Health Check</SelectItem>
            </SelectContent>
          </Select>
          <Select value={mode} onValueChange={v => setMode(v as RunMode)}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="step-through">Step-through</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-1.5 ml-auto">
            <Button size="sm" onClick={handleStart} disabled={isRunning} className="h-8">
              <Play className="h-3.5 w-3.5 mr-1" /> Run
            </Button>
            {isRunning && (
              <Button size="sm" variant="outline" onClick={stop} className="h-8">
                <Square className="h-3.5 w-3.5 mr-1" /> Stop
              </Button>
            )}
            {replayRun && !isRunning && (
              <Button size="sm" variant="outline" onClick={handleReplay} className="h-8">
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Replay
              </Button>
            )}
          </div>
        </div>
        {(flowId === 'ingest-only' || flowId === 'full-pipeline') && (
          <Textarea
            value={workoutText}
            onChange={e => setWorkoutText(e.target.value)}
            placeholder="Describe a workout (e.g. bench press 3x10, squat 3x8)"
            className="text-xs min-h-[60px] resize-none"
          />
        )}
      </div>

      {/* Step-through edit form */}
      {pausedStep && (
        <div className="px-4 py-3 border-b">
          <StepEditForm
            step={pausedStep}
            onContinue={continueWithEdit}
            onAbort={stop}
          />
        </div>
      )}

      {/* Run status + steps */}
      <div className="flex flex-1 min-h-0">
        <div className="flex flex-col flex-1 min-h-0">
          {run && (
            <div className="flex items-center gap-2 px-4 py-2 border-b">
              <Badge variant={run.status === 'success' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'}>
                {run.status}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono truncate">{run.id}</span>
            </div>
          )}

          <Tabs value={view} onValueChange={v => setView(v as typeof view)} className="flex flex-col flex-1 min-h-0">
            <TabsList className="mx-4 mt-2 w-fit">
              <TabsTrigger value="steps" className="text-xs">Steps</TabsTrigger>
              <TabsTrigger value="raw" className="text-xs">Raw JSON</TabsTrigger>
            </TabsList>

            <TabsContent value="steps" className="flex-1 min-h-0 mt-2">
              <ScrollArea className="h-full px-4 pb-4">
                {!run && (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Configure a flow above and click Run
                  </p>
                )}
                <div className="space-y-2">
                  {run?.steps.map(step => (
                    <StepCard
                      key={step.id}
                      step={step}
                      isSelected={selectedStepId === step.id}
                      onClick={() => setSelectedStepId(step.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="raw" className="flex-1 min-h-0 mt-2">
              <ScrollArea className="h-full px-4 pb-4">
                <pre className="text-xs font-mono whitespace-pre-wrap break-all p-3 bg-muted/30 rounded-md">
                  {run ? JSON.stringify(run, null, 2) : 'No run selected'}
                </pre>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right detail panel */}
        {selectedStep && (
          <div className="w-80 border-l shrink-0">
            <StepDetail step={selectedStep} />
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/dev/pipeline/components/PipelineCanvas.tsx
git commit -m "feat(observatory): add PipelineCanvas with run controls, step view, and inline detail"
```

---

## Task 11: Vite Entry Point + Main Page

This wires everything into a standalone page at `localhost:3000/pipeline.html`.

**Files:**
- Create: `pipeline.html` (project root)
- Create: `src/dev/pipeline/main.tsx`
- Create: `src/dev/pipeline/PipelineObservatory.tsx`
- Modify: `vite.config.ts`

**Step 1: Create the HTML entry**

Create `pipeline.html` in the project root (same level as `index.html`):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AmakaFlow Pipeline Observatory</title>
    <link rel="stylesheet" href="/src/index.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/dev/pipeline/main.tsx"></script>
  </body>
</html>
```

**Step 2: Create main.tsx**

Create `src/dev/pipeline/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PipelineObservatory } from './PipelineObservatory';
import '../../index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PipelineObservatory />
  </StrictMode>
);
```

**Step 3: Create PipelineObservatory (root component)**

Create `src/dev/pipeline/PipelineObservatory.tsx`:

```tsx
import { useState } from 'react';
import { Toaster } from 'sonner';
import { ServiceHealth } from './components/ServiceHealth';
import { RunHistory } from './components/RunHistory';
import { PipelineCanvas } from './components/PipelineCanvas';
import type { PipelineRun } from './store/runTypes';

export function PipelineObservatory() {
  const [selectedRun, setSelectedRun] = useState<PipelineRun | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showNewRun, setShowNewRun] = useState(true);

  function handleRunSaved() {
    setRefreshTrigger(t => t + 1);
  }

  function handleSelectRun(run: PipelineRun) {
    setSelectedRun(run);
    setShowNewRun(false);
  }

  function handleNewRun() {
    setSelectedRun(null);
    setShowNewRun(true);
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <Toaster position="top-center" />
      {/* Header */}
      <div className="px-4 py-2 border-b flex items-center gap-3">
        <span className="font-bold text-sm">🔭 Pipeline Observatory</span>
        <span className="text-xs text-muted-foreground">AmakaFlow dev tool</span>
      </div>
      <ServiceHealth />
      {/* Three-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Run history */}
        <div className="w-56 shrink-0">
          <RunHistory
            selectedRunId={selectedRun?.id ?? null}
            onSelectRun={handleSelectRun}
            onNewRun={handleNewRun}
            refreshTrigger={refreshTrigger}
          />
        </div>
        {/* Center + right: Canvas (includes inline detail panel) */}
        <div className="flex-1 min-w-0">
          <PipelineCanvas
            replayRun={showNewRun ? null : selectedRun}
            onRunSaved={handleRunSaved}
          />
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Add second entry point to vite.config.ts**

In `vite.config.ts`, find the `build.rollupOptions` block and add `input`:

```ts
build: {
  target: 'esnext',
  outDir: 'build',
  rollupOptions: {
    input: {
      main: './index.html',
      pipeline: './pipeline.html',
    },
    output: {
      manualChunks: {
        'vendor-recharts': ['recharts'],
        'vendor-sentry': ['@sentry/react', '@sentry/browser'],
        'vendor-lottie': ['lottie-react'],
      },
    },
  },
},
```

**Step 5: Verify dev server serves the page**

```bash
# Start dev server in background and check it's serving the new entry
curl -s http://localhost:3000/pipeline.html | head -5
```

If the dev server isn't running, start it (`npm run dev`) and visit `http://localhost:3000/pipeline.html` in the browser. You should see the Observatory layout with the service health bar.

**Step 6: Run all tests to confirm nothing broke**

```bash
npm run test:pipelines 2>&1 | tail -5
npm run test:fixtures 2>&1 | tail -5
npx vitest run src/dev/pipeline/ 2>&1 | tail -10
```

Expected: 16 pipeline tests pass, 6 fixture tests pass, 9 observatory tests pass (schemaValidator: 5, pipelineRunner: 4).

**Step 7: Commit**

```bash
git add pipeline.html src/dev/pipeline/main.tsx src/dev/pipeline/PipelineObservatory.tsx vite.config.ts
git commit -m "feat(observatory): add standalone Vite entry point — localhost:3000/pipeline.html"
```

---

## Done State

- `http://localhost:3000/pipeline.html` loads the Pipeline Observatory (no auth required)
- ServiceHealth bar shows live red/green status for all 6 APIs with latency
- RunHistory sidebar shows last 100 runs from IndexedDB, survives page refresh
- PipelineCanvas lets you pick a flow, enter inputs, and run with real-time step-by-step trace
- Step-through mode pauses after each step with an editable JSON form before continuing
- StepDetail shows request, response, schema validation (per-field), and audit diff when edited
- All observatory unit tests pass (`npm run vitest run src/dev/pipeline/`)
- All existing pipeline/fixture/contract tests still pass
- Zero backend changes required
