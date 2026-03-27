# Backend Contract Tests + OpenAPI Codegen Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan from this design.

**Goal:** Add live contract tests for the ingestor-api and mapper-api that validate response shapes against the existing Zod schemas, and add OpenAPI codegen + compile-time `_Verify` types to catch backend drift before it reaches the UI.

**Architecture:** Two phases in one ticket. Phase 1 adds contract test files that call real endpoints and parse responses through existing Zod schemas — same graceful-skip pattern as `progression.contract.test.ts`. Phase 2 installs `openapi-typescript`, generates TypeScript types from each service's `/openapi.json`, commits them, and adds `_Verify` type assertions to the Zod schema files. This creates a four-layer safety net: generated types → Zod schema → fixture validation → live contract test.

**Tech Stack:** Zod (already installed), openapi-typescript (new devDependency), Vitest (already installed), TypeScript

**Scope:** ingestor-api and mapper-api only. The other four services (calendar, chat, strava, garmin) are follow-on.

---

## Problem

The pipeline tests from AMA-925 validate that the UI pipeline orchestrates API calls correctly — but they use MSW mocks, not real backend responses. If the backend changes a response field shape, the pipeline tests stay green while the live app breaks silently.

The Zod schemas in `src/api/schemas/` express what the UI expects from the backend, but nothing currently validates those schemas against a real API response. The `_Verify` type pattern ensures the Zod schemas stay aligned with the backend's own OpenAPI spec at compile time.

---

## Phase 1: Contract Tests

```
src/lib/__tests__/contracts/
  ingestor.contract.test.ts   ← NEW
  mapper.contract.test.ts     ← NEW
  progression.contract.test.ts  ← already exists (AJV, leave as-is)
```

### Pattern

```ts
// src/lib/__tests__/contracts/ingestor.contract.test.ts
import { WorkoutStructureSchema } from '../../../api/schemas/ingestor';
import { API_URLS } from '../../../lib/config';

const TEST_SOURCE = { type: 'text', content: 'bench press 3x10, squat 3x8' };

async function isApiAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URLS.INGESTOR}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch { return false; }
}

describe('ingestor-api contract', () => {
  it('POST /ingest/ai_workout returns a shape conforming to WorkoutStructureSchema', async () => {
    if (!await isApiAvailable()) return;
    const res = await fetch(`${API_URLS.INGESTOR}/ingest/ai_workout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': 'contract-test' },
      body: JSON.stringify({ source: TEST_SOURCE }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(() => WorkoutStructureSchema.parse(data)).not.toThrow();
  });
});
```

Key decisions:
- **Auth**: `x-test-user-id: contract-test` header — same as `progression.contract.test.ts`, no token needed locally
- **Health check**: `/health` with 3s timeout — test returns early (not skipped) if API unreachable
- **Assertion**: one test per endpoint, validates shape only — business logic is pytest's job
- **No MSW**: contract tests hit the real network

### Mapper contract test

Sends a known exercise list to `POST /validate`, parses with `ValidationResponseSchema`. The request body mirrors what `runIngestionPipeline` sends: `{ exercises: ['bench press', 'squat'] }`.

---

## Phase 2: OpenAPI Codegen + _Verify Types

### Install

```bash
npm install --save-dev openapi-typescript
```

### npm scripts

```json
"generate:types:ingestor": "openapi-typescript $VITE_INGESTOR_API_URL/openapi.json -o src/api/generated/ingestor.d.ts",
"generate:types:mapper":   "openapi-typescript $VITE_MAPPER_API_URL/openapi.json -o src/api/generated/mapper.d.ts",
"generate:types":          "npm run generate:types:ingestor && npm run generate:types:mapper"
```

### Generated files

```
src/api/generated/
  ingestor.d.ts   ← auto-generated, never hand-edited, committed to git
  mapper.d.ts     ← auto-generated, never hand-edited, committed to git
```

Files have `// @generated — do not edit` header. PRs touching them are flagged for backend contract review. Regeneration runs manually or in a scheduled CI job — not on every CI run.

### _Verify types

Added to each existing Zod schema file:

```ts
// src/api/schemas/ingestor.ts (addition)
import type { paths } from '../generated/ingestor';
type WorkoutStructureResponse =
  paths['/ingest/ai_workout']['post']['responses'][200]['content']['application/json'];

type _Verify = z.infer<typeof WorkoutStructureSchema> extends WorkoutStructureResponse
  ? true
  : never;
```

```ts
// src/api/schemas/mapper.ts (addition)
import type { paths } from '../generated/mapper';
type ValidationResponse =
  paths['/validate']['post']['responses'][200]['content']['application/json'];

type _Verify = z.infer<typeof ValidationResponseSchema> extends ValidationResponse
  ? true
  : never;
```

If the backend changes a field and a developer regenerates types, TypeScript errors on `_Verify` until the Zod schema is updated to match.

---

## Four-Layer Safety Net

| Layer | Tool | When it catches drift |
|-------|------|-----------------------|
| Generated types | openapi-typescript | At codegen time — developer sees immediately |
| Zod schema alignment | `_Verify` type | At compile time — CI fails on `tsc --noEmit` |
| Fixture validation | `fixtures.test.ts` | On every `npm test` run |
| Live contract test | `ingestor/mapper.contract.test.ts` | On `npm run test:contracts` with live API |

---

## Migration Path

**Phase 1 — Contract tests** (can run without backend locally, graceful skip)
1. Write `ingestor.contract.test.ts`
2. Write `mapper.contract.test.ts`
3. Verify `npm run test:contracts` passes (or skips gracefully) locally

**Phase 2 — OpenAPI codegen**
1. Install `openapi-typescript`
2. Add `generate:types` scripts
3. Run codegen against local backend, commit generated files
4. Add `_Verify` types to `src/api/schemas/ingestor.ts` and `src/api/schemas/mapper.ts`
5. Verify `npx tsc --noEmit` passes

**Done state:**
- `npm run test:contracts` validates ingestor + mapper response shapes against live APIs
- `npx tsc --noEmit` catches Zod schema drift from the OpenAPI spec at compile time
- `src/api/generated/` is committed and flagged in PR review when touched
