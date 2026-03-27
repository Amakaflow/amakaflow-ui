# API Layer Architecture Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan from this design.

**Goal:** Replace scattered `isDemoMode` branches and untyped API calls with a layered architecture (generated types → Zod schemas → typed clients → MSW handlers) that provides compile-time safety, runtime validation, contract testing, and a clean foundation for an agentic future.

**Architecture:** Three independent safety layers share the same contracts: `openapi-typescript` generates TypeScript types from each service's `/openapi.json`; Zod schemas (derived from generated types) validate at runtime; MSW handlers intercept `fetch()` in demo/test mode so app code never branches on `isDemoMode`. All six backend services are covered. Migration is incremental — one service per PR, old files deleted only when fully replaced.

**Tech Stack:** openapi-typescript (codegen), zod (runtime validation), msw (network interception, already installed), vitest (contract tests), authenticated-fetch.ts (unchanged HTTP primitive)

---

## Agentic Compatibility

This architecture is explicitly designed to support a future agentic approach:

- **Typed clients** → each client function is already shaped like an MCP tool definition (name, typed args, typed return). Wrapping as agent tools requires no changes to the API layer.
- **Zod schemas** → agents can self-validate inputs before calling and validate responses before acting. No hallucinated shapes.
- **Contract tests** → protect agent tool definitions from silent breakage when the backend changes.
- **Long-term:** `src/api/clients/` can be extracted into a published `@amakaflow/api-sdk` package shared by UI and agents.

The agentic pivot becomes a packaging decision, not a rewrite.

---

## Layer Structure

```
src/
├── api/
│   ├── generated/           ← auto-generated, never hand-edited
│   │   ├── mapper.d.ts
│   │   ├── ingestor.d.ts
│   │   ├── calendar.d.ts
│   │   ├── chat.d.ts
│   │   ├── strava.d.ts
│   │   └── garmin.d.ts
│   ├── schemas/             ← hand-maintained Zod schemas derived from generated types
│   │   ├── mapper.ts
│   │   ├── ingestor.ts
│   │   ├── calendar.ts
│   │   ├── chat.ts
│   │   ├── strava.ts
│   │   └── garmin.ts
│   ├── clients/             ← one file per service, thin wrappers around authenticated-fetch
│   │   ├── mapper.ts
│   │   ├── ingestor.ts
│   │   ├── calendar.ts
│   │   ├── chat.ts
│   │   ├── strava.ts
│   │   └── garmin.ts
│   └── mocks/               ← MSW handlers, replaces all isDemoMode branches
│       ├── handlers/
│       │   ├── mapper.ts
│       │   ├── ingestor.ts
│       │   ├── calendar.ts
│       │   ├── chat.ts
│       │   ├── strava.ts
│       │   ├── garmin.ts
│       │   └── index.ts
│       └── browser.ts       ← MSW worker setup
├── lib/
│   ├── authenticated-fetch.ts   ← unchanged
│   ├── config.ts                ← unchanged
│   └── ...                      ← existing files stay during migration
```

App code calls `src/api/clients/<service>.ts`. The client always makes a real `fetch()`. In demo mode, MSW intercepts before it hits the network. Zero `isDemoMode` branches in app code or client files.

---

## Type Codegen Pipeline

Install: `openapi-typescript` as devDependency only.

npm scripts:
```json
"generate:types": "npm run generate:types:mapper && ...",
"generate:types:mapper":   "openapi-typescript $MAPPER_API_URL/openapi.json -o src/api/generated/mapper.d.ts",
"generate:types:ingestor": "openapi-typescript $INGESTOR_API_URL/openapi.json -o src/api/generated/ingestor.d.ts",
"generate:types:calendar": "openapi-typescript $CALENDAR_API_URL/openapi.json -o src/api/generated/calendar.d.ts",
"generate:types:chat":     "openapi-typescript $CHAT_API_URL/openapi.json -o src/api/generated/chat.d.ts",
"generate:types:strava":   "openapi-typescript $STRAVA_API_URL/openapi.json -o src/api/generated/strava.d.ts",
"generate:types:garmin":   "openapi-typescript $GARMIN_API_URL/openapi.json -o src/api/generated/garmin.d.ts"
```

Clients consume generated types via path-based access:
```ts
import type { paths } from '../generated/mapper';
type ValidateRequest = paths["/validate"]["post"]["requestBody"]["content"]["application/json"];
type ValidateResponse = paths["/validate"]["post"]["responses"][200]["content"]["application/json"];
```

Rules:
- `src/api/generated/` is committed to git — CI only needs to type-check, not regenerate
- Generation runs manually or in a scheduled CI job when backend changes
- Files have `// @generated` header — PRs touching them are flagged for backend contract review

---

## Zod Schemas

Zod schemas are hand-maintained, derived from generated types. A `_Verify` type enforces alignment at compile time:

```ts
// src/api/schemas/mapper.ts
import { z } from 'zod';
import type { ValidationResponse } from '../generated/mapper';

export const ValidationResponseSchema = z.object({
  success: z.boolean(),
  matches: z.array(z.object({
    original_name: z.string(),
    matched_name: z.string().nullable(),
    confidence: z.number().min(0).max(1),
    garmin_id: z.string().nullable(),
  })),
  unmapped: z.array(z.string()),
});

// Compile-time enforcement: if backend changes and you regenerate types,
// TypeScript errors here until the Zod schema is updated.
type _Verify = z.infer<typeof ValidationResponseSchema> extends ValidationResponse ? true : never;
```

Validation runs only at the API boundary in the client — `parse()` throws `ZodError` with field-level detail if shape is wrong.

Same schemas are imported by contract tests — no duplication.

---

## MSW Handlers

MSW bootstrap in `src/main.tsx` (the only `isDemoMode` check that remains):
```ts
if (import.meta.env.VITE_DEMO_MODE === 'true') {
  const { worker } = await import('./api/mocks/browser');
  await worker.start({ onUnhandledRequest: 'warn' });
}
```

Handler pattern (typed against generated types):
```ts
// src/api/mocks/handlers/mapper.ts
import { http, HttpResponse } from 'msw';
import type { ValidationResponse } from '../../generated/mapper';

export const mapperHandlers = [
  http.post(`${API_URLS.MAPPER}/validate`, async ({ request }) => {
    const body = await request.json();
    const response: ValidationResponse = { /* realistic mock data */ };
    return HttpResponse.json(response);
  }),
];
```

MSW handlers also work in Storybook (via msw-storybook-addon, already installed) and Vitest — same realistic mock data across demo mode, stories, and unit tests.

Migration rule: MSW handler is added before `isDemoMode` branch is deleted. Demo mode always works.

---

## Contract Tests

One test file per service. Pattern:

```ts
// src/lib/__tests__/contracts/<service>.contract.test.ts
import { SomeResponseSchema } from '../../../api/schemas/<service>';

describe('<service>-api contract', () => {
  it('endpoint returns valid shape', async () => {
    if (!await isApiAvailable()) return; // graceful skip
    const data = await callRealEndpoint();
    expect(() => SomeResponseSchema.parse(data)).not.toThrow();
  });
});
```

npm scripts:
```json
"test:contracts":    "vitest run src/lib/__tests__/contracts/",
"test:contracts:ci": "MAPPER_API_URL=https://staging-... vitest run src/lib/__tests__/contracts/"
```

Contract tests are excluded from default `npm test` (slow, network-dependent).

---

## Migration Path

**Phase order** (one service per PR):
1. mapper-api — highest value, most complex responses
2. ingestor-api — used in import flow
3. calendar-api — clean isolated file already
4. chat-api
5. strava-api
6. garmin-api

**Per-service checklist:**
1. `npm run generate:types:<service>` → commit generated types
2. Write Zod schemas in `src/api/schemas/<service>.ts`
3. Write client in `src/api/clients/<service>.ts`
4. Write MSW handler in `src/api/mocks/handlers/<service>.ts`
5. Write contract test in `src/lib/__tests__/contracts/<service>.contract.test.ts`
6. Update call sites to import from new client
7. Delete `isDemoMode` branches replaced by the MSW handler
8. Delete old `src/lib/<service>-api.ts` file

**Done state:**
- `src/lib/api.ts` — deleted
- `src/lib/calendar-api.ts` — deleted
- `src/lib/workout-history.ts` — `isDemoMode` branches stripped
- `isDemoMode` import count — 0 (only exists in `src/main.tsx` bootstrap)
