# Architecture

> **Components render. Hooks orchestrate. `lib/` fetches.**

---

## Decision Tree

```
Where does this code go?

Is it a pure function or data transform?        → src/lib/
Is it an API call?                              → src/lib/<domain>-api.ts
Is it stateful logic or side effects?
  Global (auth, history, keyboard shortcuts)?   → src/app/
  Feature-scoped?                               → src/components/<Feature>/hooks/
Is it JSX?                                      → src/components/<Feature>/<Feature>.tsx
```

---

## The Layers

### `src/lib/` — Pure functions and API calls

No React, no state. If it can be called from a Node script, it belongs here.

**Example:** `src/lib/bulk-import-api.ts` — all HTTP calls to the workout ingestor API.

### `src/components/<Feature>/hooks/` — Stateful logic and side effects

No JSX. Hooks own state machines, API call orchestration, and side effects. They are tested with `renderHook()` — no DOM required.

**Example:** `src/components/Import/hooks/useImportFlow.ts` — phase state machine that orchestrates `useImportQueue` and `useImportProcessing`.

### `src/components/<Feature>/` — JSX only

No API calls. No business logic. Components receive data and callbacks from a hook and render them. All state comes from a hook or is local UI state (`isOpen`, `isDragOver`).

**Example:** `src/components/Import/ImportScreen.tsx` — thin shell, calls only `useImportFlow`, renders the current phase.

### `src/app/` — Global cross-cutting concerns

Auth, routing, keyboard shortcuts. Things that every view needs but no single feature owns.

**Example:** `src/app/useAppAuth.ts` — Clerk session watcher + Supabase profile sync.

---

## Worked Example — Import Screen

```
src/components/Import/
  hooks/
    useImportQueue.ts       ← queue state, URL parsing, file type detection
    useImportProcessing.ts  ← API calls, per-item status, retry
    useImportFlow.ts        ← phase state machine, orchestrates the two above
    __tests__/              ← renderHook() tests — no DOM, no ImportScreen render
  ImportScreen.tsx          ← thin shell: calls useImportFlow, renders tabs
  FileImportTab.tsx         ← presentation only: drag-drop zone, calls onFilesDetected
  ImportQueue.tsx           ← presentation only
  ProcessingView.tsx        ← presentation only
  ResultsScreen.tsx         ← presentation only
  BlockPicker.tsx           ← presentation only
  ClipQueueTab.tsx          ← presentation only (placeholder)
  IntegrationsTab.tsx       ← presentation only (placeholder)
  index.ts                  ← re-exports ImportScreen
```

**How a new import source (e.g. Notion) would be added:**
1. Add a `NotionTab.tsx` presentation component
2. Wire it into `useImportFlow` (add a handler that calls `addUrls`)
3. Add the tab to `ImportScreen.tsx`
4. `ImportScreen.tsx` itself does not change its structure

**How to test the import flow:**
```typescript
const { result } = renderHook(() => useImportFlow({ userId, onDone, onEditWorkout }));
act(() => result.current.addUrls('https://example.com'));
await act(async () => result.current.handleImport());
expect(result.current.phase).toBe('results');
```

---

## Adding a New Screen

1. Create `src/components/<Feature>/hooks/use<Feature>.ts` — logic first, no JSX
2. Write `renderHook()` tests — no DOM, no rendering the screen
3. Create `src/components/<Feature>/<Feature>.tsx` — thin shell, imports only `use<Feature>`
4. Create `src/components/<Feature>/index.ts` — re-export the screen component
5. Add one line to `src/app/router.tsx`:
   ```typescript
   export const MyScreen = lazy(() =>
     import('../components/MyFeature').then(m => ({ default: m.MyScreen }))
   );
   ```
6. Add `'my-feature'` to the `View` union near the top of `src/app/router.tsx`.
7. In `src/app/WorkflowView.tsx`, add a render block:
   ```tsx
   {currentView === 'my-feature' && (
     <MyScreen userId={user.id} onDone={() => setCurrentView('home')} />
   )}
   ```
   `Suspense` is already in `AppShell` — no changes needed there.

---

## PR Checklist

Before merging any screen-level change:

- [ ] No `fetch`, `axios`, or `supabase` calls inside a component
- [ ] No domain state derived inline — comes from a hook
- [ ] New screen added in one line in `router.tsx`
- [ ] Hook has `renderHook()` tests that don't render the full screen
- [ ] `ImportScreen` serves as the reference — ask: "does this look like Import/?"

---

## Reference

- **Phase 1 (App.tsx decompose):** `src/app/` — `AppShell.tsx`, `useAppAuth.ts`, `useWorkoutHistory.ts`, `router.tsx`
- **Phase 2 (Import hooks):** `src/components/Import/` — the canonical reference implementation
- **Design docs:** `docs/plans/2026-03-01-react-architecture-strangler-fig.md`
