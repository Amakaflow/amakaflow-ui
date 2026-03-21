# Pipeline Observatory Design

**Goal:** A developer tool at `/dev/pipeline` inside amakaflow-ui that acts as a visual agent console — trigger pipeline runs, observe each step's request/response/schema in real-time, intervene to edit data between steps, and build a full audit trail of every run.

**North star:** This is David's primary interface as an agent-first user. It replaces the UI for his own use. He triggers flows, agents trigger flows, and this tool shows exactly what happened at every step for both.

---

## The Problem

The contract tests verify the API shapes are correct in isolation. But they don't show:
- What the full pipeline does end-to-end in real conditions
- Whether an agent's output at step N is actually correct input for step N+1
- When something drifts, exactly which step caused it and what the raw data looked like
- Whether systematic fixes are needed (agent always returns X wrong) vs one-offs

---

## Layout

Three-panel layout, dev-mode only (`/dev/pipeline`):

```
┌─────────────────┬──────────────────────────────────────┬─────────────────────┐
│  Run History    │  [Service Health Bar]                │  Step Detail        │
│                 │  ● Ingestor  ● Mapper  ● Garmin ...  │                     │
│  ● Full run     ├──────────────────────────────────────│  POST /ingest/...   │
│    2m ago  ✓   │  Pipeline Canvas                     │  ─────────────────  │
│  ● Ingest only  │                                      │  Request:           │
│    5m ago  ✗   │  ┌────────┐  ┌───────┐  ┌────────┐  │  "bench press..."   │
│  ● Map only     │  │ Ingest │→ │  Map  │→ │ Export │  │                     │
│    12m ago ✓   │  │   ✓   │  │  ✓   │  │   ✗   │  │  Response (200):     │
│                 │  └────────┘  └───────┘  └────────┘  │  { title: "...",    │
│  [+] New Run    │                                      │    blocks: [...] }  │
│                 │  [Timeline] [Steps] [Raw]            │                     │
│                 │  ▶ Run  ⏹ Stop  ↺ Replay           │  Schema: ✓ PASS     │
│                 │  Mode: [Auto ▾] [Step-through ▾]    │                     │
└─────────────────┴──────────────────────────────────────┴─────────────────────┘
```

---

## Components

### Left Panel — Run History

- IndexedDB-backed list of all runs (last 100)
- Each entry: flow name, timestamp, overall status (✓/✗), total duration
- Click any run to load it into the canvas in read-only replay mode
- "New Run" opens the control form in the canvas
- Filter by: flow type, status, date

### Top Bar — Service Health

- Pings all 6 services (`/health`) every 30 seconds
- Red/green dot per service: Ingestor (8004), Mapper (8001), Garmin (8002), Strava (8000), Calendar (8003), Chat (8005)
- Click a dot to see the health response inline
- Shows latency next to each dot

### Center Panel — Pipeline Canvas

Shows the selected flow as connected step cards. Three view tabs:

- **Timeline** — horizontal timing bars per step (Chrome DevTools Network style), shows overlap and duration at a glance
- **Steps** — vertical cards, each expandable with a summary of status, duration, and key response fields
- **Raw** — full JSON for the entire run (all steps concatenated, readable)

Run controls:
- **▶ Run** — executes the flow from the top
- **⏹ Stop** — cancels mid-run
- **↺ Replay** — re-runs the selected historical run with the same inputs

Mode selector:
- **Auto** — runs all steps without pausing (agent mode)
- **Step-through** — pauses after each step with an edit interface before continuing

### Right Panel — Step Detail

Click any step card to open its full trace:

- **Request**: URL, method, headers (sanitized — no auth tokens in plain text), body
- **Response**: HTTP status code, headers, raw JSON body
- **Schema Validation**: per-field Zod result — not just pass/fail, but exactly which field failed and the error message
- In step-through mode: an **Edit** button that opens the editable form for that step's output

---

## Run Modes

### Auto Mode

Runs the full flow without stopping. Each step fires as soon as the previous completes. The trace renders in real-time as events arrive. Use this to verify a pipeline end-to-end quickly or to replay what an agent did.

### Step-Through Mode

After each step completes:
1. Pipeline pauses automatically
2. The step's output renders as an **editable structured form** (not raw JSON — actual form fields matching the response schema)
3. A diff view shows "API returned" vs "what you're sending to next step" if you've made changes
4. **Continue** button sends your (possibly edited) version to the next step
5. **Abort** cancels the run at that point

Editable forms per step:
- **After Ingest**: workout title, blocks, exercises (full StructureWorkout-style editor — reuses existing components)
- **After Map**: exercise matches — override matched_name or garmin_id per exercise, mark unmapped as "skip" or provide manual ID
- **After Export**: shows export result, option to retry with different device target

---

## Audit Trail (The Key Design Decision)

Every run stores **both** the raw API response AND the user-edited version at each step where an edit occurred.

```ts
interface PipelineStep {
  id: string;
  service: 'ingestor' | 'mapper' | 'garmin' | 'strava' | 'calendar' | 'chat';
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  request: {
    url: string;
    method: string;
    body: unknown;
  };
  response?: {
    status: number;
    body: unknown;
  };
  schemaValidation?: {
    passed: boolean;
    errors?: Array<{ path: string; message: string }>;
  };
  // The key audit fields:
  apiOutput: unknown;        // raw from API, never mutated
  effectiveOutput: unknown;  // what actually went to the next step (may differ if edited)
  edited: boolean;           // true if user changed anything
  editedAt?: number;
}
```

In the Step Detail panel, a toggle shows "API Response" vs "Sent to Next Step" when `edited: true`. This makes systematic agent drift visible: if you're always fixing the same field, it shows up in every run's history.

---

## Flows

| Flow | Steps | Primary use |
|------|-------|-------------|
| Full AI Pipeline | Text → Ingest → Map → Export | End-to-end agent verification |
| Ingest only | Text → Ingest | Does AI parsing produce the right structure? |
| Map only | Exercise list → Map | Confidence scores, garmin_id accuracy |
| Export only | Workout JSON → Export | Does a known-good workout push correctly? |
| Health check | Ping all 6 services | Is everything up? |

Export target (Full AI Pipeline and Export only): Garmin or Strava, selectable per run.

---

## Architecture

### Pure Runner (agent-ready)

The runner is a pure async generator, completely decoupled from the UI:

```ts
// pipelineRunner.ts
async function* runPipeline(
  flow: Flow,
  inputs: FlowInputs,
  mode: 'auto' | 'step-through'
): AsyncGenerator<StepEvent> {
  // yields: StepStarted, StepCompleted, StepFailed, StepPaused, RunCompleted
}
```

The UI subscribes to events and renders them. An MCP tool or agent can call `runPipeline` directly later — same events, same storage, same UI shows up automatically.

### Persistence

IndexedDB via the `idb` library. Two object stores:
- `pipeline-runs`: one record per run, keyed by `runId` (uuid)
- `pipeline-steps`: one record per step event, keyed by `(runId, stepId)`, indexed by `runId`

Steps are written as they arrive (not after the run completes) so a crashed run still has a partial trace.

### File Structure

```
src/
  dev/
    pipeline/
      page.tsx                    ← route component, wires panels together
      components/
        RunHistory.tsx            ← left sidebar
        ServiceHealth.tsx         ← top bar
        PipelineCanvas.tsx        ← center, timeline/steps/raw tabs
        StepCard.tsx              ← individual step in steps view
        StepDetail.tsx            ← right panel, request/response/schema
        StepEditForm.tsx          ← editable form in step-through mode
        StepDiff.tsx              ← "API returned vs sent to next step" diff
      flows/
        index.ts                  ← Flow type + registry
        fullPipeline.ts
        ingestOnly.ts
        mapOnly.ts
        exportOnly.ts
        healthCheck.ts
      runner/
        pipelineRunner.ts         ← core async generator
        stepExecutors.ts          ← one executor per service
        schemaValidator.ts        ← Zod validation on responses
      store/
        runStore.ts               ← IndexedDB read/write via idb
        runTypes.ts               ← PipelineRun, PipelineStep, StepEvent types
      hooks/
        usePipelineRunner.ts      ← React hook that consumes the generator
        useRunHistory.ts          ← reads from IndexedDB for the sidebar
```

### Routing

Added as a dev-only route in the existing router:

```tsx
// Only rendered when import.meta.env.DEV is true
{ path: '/dev/pipeline', element: <PipelineObservatoryPage /> }
```

No auth required — it's a local dev tool.

---

## Done State

- `/dev/pipeline` loads in the running Vite dev server
- Can trigger any of the 4 flows and see the full trace in real-time
- Step-through mode pauses after each step with an editable form
- Audit trail stores both API output and effective output when edited
- Run history sidebar shows all past runs, click to replay
- Service health bar shows live status of all 6 APIs
- Schema validation shows per-field errors in the Step Detail panel
- Zero backend changes required to ship v1
- Runner is a pure function, ready for MCP/agent integration in v2
