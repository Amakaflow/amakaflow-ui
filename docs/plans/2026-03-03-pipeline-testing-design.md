# Pipeline Integration Testing Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan from this design.

**Goal:** Replace invisible multi-API orchestration inside React hooks with a testable pipeline layer, and add scenario-based integration tests that catch schema drift and transformation bugs before they reach the UI.

**Architecture:** Extract orchestration logic (ingestor → mapper → calendar sequence) from hooks into pure pipeline functions in `src/api/pipelines/`. Add JSON scenario fixtures that serve as both MSW mock sources and test assertions. Tests validate schema conformance (minimum bar) and known scenario outputs (full assertion). Errors surface as typed `PipelineError` with actionable messages — never as silent UI failures.

**Tech Stack:** Vitest (already installed), MSW node handler (`msw/node`, already installed), Zod (already installed), TypeScript

---

## Problem

The ingestion pipeline today is hidden inside React hooks:
- `useWorkflowEditing` calls multiple API functions in sequence
- If ingestor returns an unexpected shape, Zod throws — but the error bubbles up as an unhandled rejection inside a hook, producing a confusing UI crash
- If mapper returns unmapped exercises, the UI receives them silently — no early error
- MSW mock handlers use inline data that no test validates against the Zod schemas, so mock drift goes undetected until prod

The failing unit tests (8 pre-existing failures) have the same root cause: `isDemoMode` is a module-level constant evaluated at import time, so components imported without a `vi.mock()` declaration get the real value.

---

## Layer Structure

```
src/
├── api/
│   ├── clients/          ← already exists (individual service clients)
│   ├── fixtures/
│   │   ├── services/     ← per-service valid response examples
│   │   │   ├── mapper.json
│   │   │   ├── ingestor.json
│   │   │   ├── calendar.json
│   │   │   ├── chat.json
│   │   │   ├── strava.json
│   │   │   └── garmin.json
│   │   └── scenarios/    ← full pipeline input→mock→expected-output
│   │       ├── instagram-url.json
│   │       ├── strava-activity.json
│   │       └── file-upload.json
│   └── pipelines/        ← NEW: orchestration extracted from hooks
│       ├── ingestion.ts  ← sources → WorkoutStructure (ingestor + mapper)
│       ├── export.ts     ← WorkoutStructure + device → export file
│       └── index.ts      ← re-exports + PipelineError class
└── lib/__tests__/
    ├── pipelines/        ← NEW: pipeline integration tests
    │   ├── ingestion.test.ts
    │   └── export.test.ts
    └── contracts/        ← already exists (live API contract tests)
```

---

## Scenario Fixture Format

```json
// src/api/fixtures/scenarios/instagram-url.json
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
          "structure": "main",
          "exercises": [
            { "name": "bench press", "sets": 3, "reps": 10 },
            { "name": "overhead press", "sets": 3, "reps": 8 }
          ]
        }
      ]
    },
    "mapper": {
      "success": true,
      "matches": [
        { "original_name": "bench press", "matched_name": "Bench Press", "confidence": 0.97, "garmin_id": "bench_press" },
        { "original_name": "overhead press", "matched_name": "Overhead Press", "confidence": 0.94, "garmin_id": "overhead_press" }
      ],
      "unmapped": []
    }
  },
  "expectedOutput": {
    "title": "Push Day",
    "blockCount": 1,
    "exerciseCount": 2,
    "unmapped": []
  }
}
```

The `mocks` section is imported directly into MSW handlers (no inline data in handlers). This makes fixture files the single source of truth — if a fixture drifts from a Zod schema, a schema validation test catches it immediately.

---

## Pipeline Orchestration

```ts
// src/api/pipelines/index.ts
export class PipelineError extends Error {
  constructor(
    public code: 'UnmappedExercises' | 'IngestorFailed' | 'ExportFailed',
    public detail: Record<string, unknown>
  ) {
    super(detail['message'] as string ?? code);
    this.name = 'PipelineError';
  }
}
```

```ts
// src/api/pipelines/ingestion.ts
import { generateWorkoutStructure } from '../clients/ingestor';
import { validateExercises } from '../clients/mapper';
import { PipelineError } from './index';

export interface IngestionResult {
  workout: WorkoutStructure;
  validation: ValidationResponse;
}

export async function runIngestionPipeline(
  sources: Array<{ type: string; content: string }>,
  signal?: AbortSignal
): Promise<IngestionResult> {
  const workout = await generateWorkoutStructure(sources, signal);
  const validation = await validateExercises(workout);

  if (!validation.success && validation.unmapped.length > 0) {
    throw new PipelineError('UnmappedExercises', {
      unmapped: validation.unmapped,
      message: `${validation.unmapped.length} exercise(s) could not be mapped: ${validation.unmapped.join(', ')}`,
    });
  }

  return { workout, validation };
}
```

Hooks become thin wrappers:
```ts
// inside useWorkflowEditing
const { workout, validation } = await runIngestionPipeline(sources, signal);
// update UI state with result
```

---

## Integration Test Pattern

```ts
// src/lib/__tests__/pipelines/ingestion.test.ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { runIngestionPipeline } from '../../../api/pipelines/ingestion';
import { WorkoutStructureResponseSchema } from '../../../api/schemas/ingestor';
import { ValidationResponseSchema } from '../../../api/schemas/mapper';
import instagramScenario from '../../../api/fixtures/scenarios/instagram-url.json';
import mapperFixture from '../../../api/fixtures/services/mapper.json';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ingestion pipeline — instagram URL', () => {
  it('produces a WorkoutStructure that conforms to schema', async () => {
    server.use(
      http.post('*/ingest/ai_workout', () => HttpResponse.json(instagramScenario.mocks.ingestor)),
      http.post('*/validate', () => HttpResponse.json(instagramScenario.mocks.mapper)),
    );
    const { workout } = await runIngestionPipeline(instagramScenario.input.sources);
    expect(() => WorkoutStructureResponseSchema.parse(workout)).not.toThrow();
  });

  it('returns the expected block and exercise counts', async () => {
    server.use(
      http.post('*/ingest/ai_workout', () => HttpResponse.json(instagramScenario.mocks.ingestor)),
      http.post('*/validate', () => HttpResponse.json(instagramScenario.mocks.mapper)),
    );
    const { workout } = await runIngestionPipeline(instagramScenario.input.sources);
    expect(workout.blocks).toHaveLength(instagramScenario.expectedOutput.blockCount);
    expect(workout.blocks[0].exercises).toHaveLength(instagramScenario.expectedOutput.exerciseCount);
  });

  it('throws PipelineError when exercises are unmapped', async () => {
    server.use(
      http.post('*/ingest/ai_workout', () => HttpResponse.json(instagramScenario.mocks.ingestor)),
      http.post('*/validate', () => HttpResponse.json({
        success: false, matches: [], unmapped: ['bench press', 'overhead press'],
      })),
    );
    await expect(runIngestionPipeline(instagramScenario.input.sources))
      .rejects.toMatchObject({ code: 'UnmappedExercises', detail: { unmapped: ['bench press', 'overhead press'] } });
  });
});
```

---

## Schema Drift Detection

A separate test file validates every fixture against its Zod schema. This runs in CI on every PR:

```ts
// src/lib/__tests__/fixtures.test.ts
import { ValidationResponseSchema } from '../../api/schemas/mapper';
import { WorkoutStructureResponseSchema } from '../../api/schemas/ingestor';
import mapperFixture from '../../api/fixtures/services/mapper.json';
import ingestorFixture from '../../api/fixtures/services/ingestor.json';
import instagramScenario from '../../api/fixtures/scenarios/instagram-url.json';

it('mapper service fixture conforms to ValidationResponseSchema', () => {
  expect(() => ValidationResponseSchema.parse(mapperFixture)).not.toThrow();
});
it('ingestor service fixture conforms to WorkoutStructureResponseSchema', () => {
  expect(() => WorkoutStructureResponseSchema.parse(ingestorFixture)).not.toThrow();
});
it('instagram scenario mocks conform to their schemas', () => {
  expect(() => ValidationResponseSchema.parse(instagramScenario.mocks.mapper)).not.toThrow();
  expect(() => WorkoutStructureResponseSchema.parse(instagramScenario.mocks.ingestor)).not.toThrow();
});
```

---

## Fixing the 8 Pre-existing Test Failures

These are a prerequisite and are simple fixes:

| File | Fix |
|------|-----|
| `BlockConfigRow.test.tsx` | Add `vi.mock('../../lib/demo-mode', () => ({ isDemoMode: false }))` |
| `NavBar.test.tsx` | Move mock declaration before all imports (hoisting) |
| `useWorkflowEditing.test.ts` | Add `vi.mock('../../lib/demo-mode')` + `vi.mock('../../lib/workout-history')` |
| `workout-utils.test.ts` | Investigate — pure functions should not need mocking; likely a stale import |
| `demo-mode.test.ts` | Audit for any remaining migration-caused import errors |

---

## Migration Path

**Phase 1 — Fix failing tests (prerequisite)**
1 PR, 5 files touched, no new structure added.

**Phase 2 — Pipeline extraction + ingestion tests**
- Create `src/api/pipelines/` with `PipelineError`, `runIngestionPipeline`
- Create service fixtures (`src/api/fixtures/services/*.json`)
- Create scenario fixtures for Instagram, file upload
- Write `ingestion.test.ts` and `fixtures.test.ts`
- Update `useWorkflowEditing` to call pipeline function
- Update MSW handlers to import fixtures instead of inline data

**Phase 3 — Export pipeline + Strava scenario**
- Create `runExportPipeline` function
- Add Strava scenario fixture
- Write `export.test.ts`

**Done state:**
- `npm test` includes pipeline tests and fixture schema tests
- Any fixture that drifts from a Zod schema fails CI immediately
- UI hooks call pipeline functions — no direct API calls in hooks
- Errors from pipelines are typed `PipelineError` with actionable detail
