# Unified Import Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the separate "Single Import" (workflow view) and "Bulk Import" views with a single unified Import screen that accepts one or many URLs, images, PDFs, or files, auto-processes them, and lets the user save all as separate workouts or combine blocks into one Frankenstein workout.

**Architecture:** New `UnifiedImportScreen` component (three tabs: URLs & Media, File, Integrations) sits over the existing `useBulkImportApi` + `BulkImportContext` + backend APIs — those do not change. The old workflow/AddSources and BulkImport views stay in the codebase but are no longer linked from the nav; they are removed in a follow-up cleanup ticket. The export/device mapping step is removed from import entirely. Rest duration stays as workout data; rest type/device rendering moves to a future export flow.

**Tech Stack:** React 18, TypeScript, `@dnd-kit/core` + `@dnd-kit/sortable` (already installed), Vitest + React Testing Library, Tailwind, shadcn/ui, `saveWorkoutToHistory` (src/lib/workout-history.ts), existing `useBulkImportApi` + `BulkImportContext`.

**Design principles:** Progressive Disclosure (each screen shows only what the current step needs); Dieter Rams "Less, but better" (no export, device, or mapping options visible during import).

**Test command:** `npm run test:run`
**Dev server:** `npm run dev` (then open http://localhost:3015)

> **Note:** 11 pre-existing test failures exist before this work (DraggableBlock.test.tsx, demo-mode.test.ts, etc.) — these are not caused by this feature. Do not let them block progress. Task 1 handles the directly-related `DraggableBlock.test.tsx` cleanup.

---

## Reference

- Design doc: `docs/plans/2026-02-28-unified-import-flow-design.md`
- Nav location: `src/App.tsx` lines 1405–1443 (Import dropdown)
- Existing bulk import context: `src/context/BulkImportContext.tsx`
- Existing bulk import hook: `src/hooks/useBulkImportApi.ts`
- Existing detect/process APIs: `src/lib/bulk-import-api.ts`
- Existing bulk import types: `src/types/bulk-import.ts`
- Save to library: `src/lib/workout-history.ts` → `saveWorkoutToHistory()`
- StructureWorkout editor: `src/components/StructureWorkout.tsx`
- Column mapping step (reuse): `src/components/BulkImport/MapStep.tsx`

---

## Task 1: Clean up broken DraggableBlock tests

The `DraggableBlock.test.tsx` tests the old react-dnd-based `DraggableBlock` component, which was renamed to `SortableBlock` in AMA-805. These tests fail because `DraggableBlock` no longer exists.

**Files:**
- Delete: `src/components/__tests__/DraggableBlock.test.tsx`
- Modify: `src/components/__tests__/StructureWorkout.integration.test.tsx` (update imports if needed)

**Step 1: Confirm the failures are stale imports**

```bash
npx vitest run src/components/__tests__/DraggableBlock.test.tsx 2>&1 | head -30
```

Expected: errors about `DraggableBlock` not found or react-dnd not being mocked.

**Step 2: Delete the file**

```bash
rm src/components/__tests__/DraggableBlock.test.tsx
```

**Step 3: Run tests to confirm failure count drops**

```bash
npm run test:run 2>&1 | grep "Test Files"
```

Expected: `DraggableBlock.test.tsx` no longer appears in the failed list.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove stale DraggableBlock tests (replaced by SortableBlock in AMA-805)"
```

---

## Task 2: New types

**Files:**
- Create: `src/types/unified-import.ts`

**Step 1: Create the types file**

```typescript
// src/types/unified-import.ts

/**
 * Types for the unified import flow.
 *
 * This replaces the separate "Single Import" (workflow) and "Bulk Import" paths.
 * All input sources (URLs, images, PDFs, files, integrations) flow through
 * the same queue → process → results pipeline.
 */

/** Which tab the user has open on the import screen. */
export type ImportTab = 'urls-media' | 'file' | 'integrations';

/** A single item in the pre-import queue (before processing). */
export interface QueueItem {
  id: string;              // stable local UUID (use crypto.randomUUID())
  type: 'url' | 'image' | 'pdf' | 'text';
  label: string;           // display label (truncated URL, filename, etc.)
  raw: string | File;      // the actual payload
}

/** Per-item processing state. */
export type ItemStatus = 'pending' | 'detecting' | 'extracting' | 'done' | 'failed';

export interface ProcessedItem {
  queueId: string;         // links back to QueueItem.id
  status: ItemStatus;
  errorMessage?: string;
  /** Populated when status === 'done'. Shape matches PreviewWorkout from bulk-import types. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workout?: any;           // WorkoutStructure — typed loosely to avoid circular deps
  workoutTitle?: string;
  blockCount?: number;
  exerciseCount?: number;
  sourceIcon?: 'youtube' | 'tiktok' | 'instagram' | 'pinterest' | 'image' | 'pdf' | 'text' | 'file';
}

/** What the user wants to do with the results. */
export type ResultsAction = 'save-all' | 'build-one';

/** A block selected in the block picker. */
export interface SelectedBlock {
  workoutIndex: number;    // index into ProcessedItem[]
  blockIndex: number;      // index into workout.blocks[]
  blockId: string;
  blockLabel: string;
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

**Step 3: Commit**

```bash
git add src/types/unified-import.ts
git commit -m "feat: add unified import types"
```

---

## Task 3: App.tsx — add 'import' view and update nav

**Files:**
- Modify: `src/App.tsx`

The goal is to:
1. Add `'import'` to the `View` union type
2. Replace the Import dropdown (Single Import + Bulk Import menu items) with a single "Import" button that sets `currentView('import')`
3. Add a `{currentView === 'import' && <div>Import coming soon</div>}` placeholder so we can confirm routing works
4. Keep the `workflow` and `bulk-import` views in place — they will be removed in a follow-up

**Step 1: Add 'import' to the View type (line 66)**

Find:
```typescript
type View = 'home' | 'workflow' | 'profile' | 'analytics' | 'team' | 'settings' | 'strava-enhance' | 'calendar' | 'workouts' | 'mobile-companion' | 'bulk-import' | 'help' | 'exercise-history' | 'volume-analytics' | 'program-detail' | 'programs' | 'create-ai' ;
```

Replace with (add `'import'`):
```typescript
type View = 'home' | 'workflow' | 'profile' | 'analytics' | 'team' | 'settings' | 'strava-enhance' | 'calendar' | 'workouts' | 'mobile-companion' | 'bulk-import' | 'import' | 'help' | 'exercise-history' | 'volume-analytics' | 'program-detail' | 'programs' | 'create-ai' ;
```

**Step 2: Replace the Import dropdown in the nav (lines ~1406–1443)**

Find the entire `<DropdownMenu>` block containing "Single Import" and "Bulk Import" and replace it with:

```tsx
<Button
  variant={(currentView === 'workflow' || currentView === 'bulk-import' || currentView === 'import') ? 'default' : 'ghost'}
  size="sm"
  className="gap-1"
  onClick={() => {
    checkUnsavedChanges(() => {
      clearWorkflowState();
      setBulkImportType(undefined);
      setCurrentView('import');
    });
  }}
>
  <Plus className="w-4 h-4" />
  Import
</Button>
```

**Step 3: Add the import view render (after the bulk-import block, around line 2039)**

Find `{currentView === 'bulk-import' && (` block. After its closing `)}`, add:

```tsx
{currentView === 'import' && (
  <div className="container mx-auto px-4 py-8">
    <p className="text-muted-foreground">Unified import — coming soon</p>
  </div>
)}
```

**Step 4: Verify the app builds**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in X.XXs`

**Step 5: Smoke-test in browser**

Run `npm run dev`, open the app, click "Import" in the nav — should see "Unified import — coming soon".

**Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add unified import view and nav entry point"
```

---

## Task 4: UnifiedImportScreen shell with three tabs

**Files:**
- Create: `src/components/UnifiedImport/index.ts`
- Create: `src/components/UnifiedImport/UnifiedImportScreen.tsx`

**Step 1: Create the directory and index**

```bash
mkdir -p src/components/UnifiedImport
```

```typescript
// src/components/UnifiedImport/index.ts
export { UnifiedImportScreen } from './UnifiedImportScreen';
```

**Step 2: Create the shell component**

```tsx
// src/components/UnifiedImport/UnifiedImportScreen.tsx
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Link, FileSpreadsheet, Plug } from 'lucide-react';
import type { ImportTab } from '../../types/unified-import';

interface UnifiedImportScreenProps {
  userId: string;
  onDone: () => void;
}

export function UnifiedImportScreen({ userId, onDone }: UnifiedImportScreenProps) {
  const [activeTab, setActiveTab] = useState<ImportTab>('urls-media');

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Import Workouts</h1>
        <p className="text-muted-foreground mt-1">
          Add one or many sources — the rest is handled for you.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ImportTab)}>
        <TabsList className="mb-6">
          <TabsTrigger value="urls-media" className="gap-2">
            <Link className="w-4 h-4" />
            URLs &amp; Media
          </TabsTrigger>
          <TabsTrigger value="file" className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            File
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Plug className="w-4 h-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="urls-media">
          <p className="text-muted-foreground">URLs &amp; Media — coming soon</p>
        </TabsContent>

        <TabsContent value="file">
          <p className="text-muted-foreground">File import — coming soon</p>
        </TabsContent>

        <TabsContent value="integrations">
          <p className="text-muted-foreground">Integrations — coming soon</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Step 3: Wire UnifiedImportScreen into App.tsx**

In `src/App.tsx`, add the import at the top:
```typescript
import { UnifiedImportScreen } from './components/UnifiedImport';
```

Replace the placeholder div added in Task 3:
```tsx
{currentView === 'import' && (
  <div className="container mx-auto px-4 py-8">
    <p className="text-muted-foreground">Unified import — coming soon</p>
  </div>
)}
```

With:
```tsx
{currentView === 'import' && (
  <UnifiedImportScreen
    userId={user.id}
    onDone={() => setCurrentView('workouts')}
  />
)}
```

**Step 4: Build check**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in X.XXs`

**Step 5: Commit**

```bash
git add src/components/UnifiedImport/ src/App.tsx
git commit -m "feat: add UnifiedImportScreen shell with three tabs"
```

---

## Task 5: ImportQueue component (URLs & Media tab)

The queue shows items as they are added before the user hits Import. Supports: URL paste (one or many, newline- or comma-separated), image drop/pick, PDF drop/pick, text paste.

**Files:**
- Create: `src/components/UnifiedImport/ImportQueue.tsx`
- Create: `src/components/UnifiedImport/__tests__/ImportQueue.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/components/UnifiedImport/__tests__/ImportQueue.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ImportQueue } from '../ImportQueue';

describe('ImportQueue', () => {
  it('adds a URL to the queue when pasted', () => {
    const onQueueChange = vi.fn();
    render(<ImportQueue queue={[]} onQueueChange={onQueueChange} />);

    const textarea = screen.getByPlaceholderText(/paste urls/i);
    fireEvent.change(textarea, { target: { value: 'https://youtube.com/watch?v=abc123' } });

    const addBtn = screen.getByRole('button', { name: /add to queue/i });
    fireEvent.click(addBtn);

    expect(onQueueChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ type: 'url', label: expect.stringContaining('youtube.com') }),
      ])
    );
  });

  it('parses multiple URLs separated by newlines', () => {
    const onQueueChange = vi.fn();
    render(<ImportQueue queue={[]} onQueueChange={onQueueChange} />);

    const textarea = screen.getByPlaceholderText(/paste urls/i);
    fireEvent.change(textarea, {
      target: { value: 'https://youtube.com/a\nhttps://tiktok.com/b' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add to queue/i }));

    expect(onQueueChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ type: 'url' }),
        expect.objectContaining({ type: 'url' }),
      ])
    );
    expect(onQueueChange.mock.calls[0][0]).toHaveLength(2);
  });

  it('removes an item when the remove button is clicked', () => {
    const item = { id: 'q1', type: 'url' as const, label: 'youtube.com/a', raw: 'https://youtube.com/a' };
    const onQueueChange = vi.fn();
    render(<ImportQueue queue={[item]} onQueueChange={onQueueChange} />);

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(onQueueChange).toHaveBeenCalledWith([]);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/UnifiedImport/__tests__/ImportQueue.test.tsx 2>&1 | tail -10
```

Expected: `FAIL` — `ImportQueue` does not exist yet.

**Step 3: Implement ImportQueue**

```tsx
// src/components/UnifiedImport/ImportQueue.tsx
import { useState } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { X, Plus, Youtube, Music2, Image, FileText, Link } from 'lucide-react';
import type { QueueItem } from '../../types/unified-import';

interface ImportQueueProps {
  queue: QueueItem[];
  onQueueChange: (queue: QueueItem[]) => void;
}

function detectSourceIcon(url: string): QueueItem['type'] {
  const l = url.toLowerCase();
  if (l.includes('youtube.com') || l.includes('youtu.be')) return 'url';
  if (l.includes('tiktok.com')) return 'url';
  if (l.includes('instagram.com')) return 'url';
  if (l.includes('pinterest.com') || l.includes('pin.it')) return 'url';
  return 'url';
}

function parseUrls(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function makeLabel(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname.slice(0, 40);
  } catch {
    return url.slice(0, 60);
  }
}

export function ImportQueue({ queue, onQueueChange }: ImportQueueProps) {
  const [urlInput, setUrlInput] = useState('');

  const addUrls = () => {
    const urls = parseUrls(urlInput);
    if (urls.length === 0) return;
    const newItems: QueueItem[] = urls.map(url => ({
      id: crypto.randomUUID(),
      type: detectSourceIcon(url),
      label: makeLabel(url),
      raw: url,
    }));
    onQueueChange([...queue, ...newItems]);
    setUrlInput('');
  };

  const remove = (id: string) => {
    onQueueChange(queue.filter(item => item.id !== id));
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newItems: QueueItem[] = Array.from(files).map(file => ({
      id: crypto.randomUUID(),
      type: file.type === 'application/pdf' ? 'pdf' : 'image',
      label: file.name,
      raw: file,
    }));
    onQueueChange([...queue, ...newItems]);
  };

  return (
    <div className="space-y-4">
      {/* URL input */}
      <div className="space-y-2">
        <Textarea
          placeholder="Paste URLs here — one per line, or comma-separated"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          rows={3}
          className="resize-none"
        />
        <Button
          onClick={addUrls}
          disabled={urlInput.trim().length === 0}
          size="sm"
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add to queue
        </Button>
      </div>

      {/* Image / PDF drop */}
      <div className="flex gap-2">
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*,.pdf"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <span>
              <Image className="w-4 h-4" />
              Add images / PDFs
            </span>
          </Button>
        </label>
      </div>

      {/* Queue list */}
      {queue.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            {queue.length} item{queue.length !== 1 ? 's' : ''} queued
          </p>
          {queue.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-2 p-2 rounded-md border bg-muted/30 text-sm"
            >
              {item.type === 'pdf' ? <FileText className="w-4 h-4 shrink-0" /> : <Link className="w-4 h-4 shrink-0" />}
              <span className="flex-1 truncate">{item.label}</span>
              <Badge variant="secondary" className="text-xs shrink-0">{item.type}</Badge>
              <Button
                variant="ghost"
                size="sm"
                className="p-0 h-auto"
                onClick={() => remove(item.id)}
                aria-label="remove"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/UnifiedImport/__tests__/ImportQueue.test.tsx 2>&1 | tail -10
```

Expected: `3 passed`.

**Step 5: Wire ImportQueue into the URLs & Media tab**

In `UnifiedImportScreen.tsx`:

```tsx
import { useState } from 'react';
import { ImportQueue } from './ImportQueue';
import type { QueueItem, ImportTab } from '../../types/unified-import';
// ...
const [queue, setQueue] = useState<QueueItem[]>([]);

// In the urls-media TabsContent:
<TabsContent value="urls-media">
  <ImportQueue queue={queue} onQueueChange={setQueue} />
  {queue.length > 0 && (
    <div className="mt-4">
      <Button className="w-full" onClick={handleImport} disabled={queue.length === 0}>
        Import {queue.length} item{queue.length !== 1 ? 's' : ''}
      </Button>
    </div>
  )}
</TabsContent>
```

Add a placeholder `handleImport` for now:
```tsx
const handleImport = () => {
  console.log('TODO: process queue', queue);
};
```

**Step 6: Build check**

```bash
npm run build 2>&1 | tail -5
```

**Step 7: Commit**

```bash
git add src/components/UnifiedImport/
git commit -m "feat: add ImportQueue component with URL + image/PDF input"
```

---

## Task 6: Processing view (per-item progress)

When the user clicks Import, each queued item shows a status badge that updates as the backend processes it. This reuses `detectFromUrls` and `detectFromImages` from `useBulkImportApi`.

**Files:**
- Create: `src/components/UnifiedImport/ProcessingView.tsx`
- Modify: `src/components/UnifiedImport/UnifiedImportScreen.tsx`

**Step 1: Create ProcessingView**

```tsx
// src/components/UnifiedImport/ProcessingView.tsx
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import type { ProcessedItem, QueueItem } from '../../types/unified-import';

interface ProcessingViewProps {
  queueItems: QueueItem[];
  processedItems: ProcessedItem[];
  onRetry: (queueId: string) => void;
}

function StatusBadge({ status }: { status: ProcessedItem['status'] }) {
  switch (status) {
    case 'pending':
      return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Pending</Badge>;
    case 'detecting':
    case 'extracting':
      return <Badge variant="secondary" className="gap-1"><Loader2 className="w-3 h-3 animate-spin" />Processing</Badge>;
    case 'done':
      return <Badge className="gap-1 bg-green-600"><CheckCircle className="w-3 h-3" />Done</Badge>;
    case 'failed':
      return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Failed</Badge>;
  }
}

export function ProcessingView({ queueItems, processedItems, onRetry }: ProcessingViewProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">
        Processing {queueItems.length} item{queueItems.length !== 1 ? 's' : ''}…
      </p>
      {queueItems.map(item => {
        const processed = processedItems.find(p => p.queueId === item.id);
        const status = processed?.status ?? 'pending';
        return (
          <div key={item.id} className="flex items-center gap-3 p-3 rounded-md border bg-muted/20">
            <span className="flex-1 text-sm truncate">{item.label}</span>
            <StatusBadge status={status} />
            {status === 'failed' && (
              <Button variant="ghost" size="sm" onClick={() => onRetry(item.id)}>
                Retry
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Add view state to UnifiedImportScreen**

Add `'processing' | 'results'` to the view states and wire up the import button to trigger processing using the existing `BulkImportProvider` + `useBulkImportApi`:

In `UnifiedImportScreen.tsx`, wrap the component with `BulkImportProvider` and use:

```tsx
import { BulkImportProvider } from '../../context/BulkImportContext';
import { useBulkImportApi } from '../../hooks/useBulkImportApi';

// Inner component that has access to context:
function UnifiedImportInner({ userId, onDone }: UnifiedImportScreenProps) {
  const [activeTab, setActiveTab] = useState<ImportTab>('urls-media');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [processedItems, setProcessedItems] = useState<ProcessedItem[]>([]);
  const [phase, setPhase] = useState<'input' | 'processing' | 'results'>('input');

  const { detectFromUrls, detectFromImages } = useBulkImportApi({ userId });

  const handleImport = async () => {
    setPhase('processing');

    // Mark all as pending
    const initial: ProcessedItem[] = queue.map(item => ({
      queueId: item.id,
      status: 'pending',
    }));
    setProcessedItems(initial);

    // Separate URLs vs images/PDFs
    const urls = queue.filter(i => i.type === 'url').map(i => i.raw as string);
    const images = queue.filter(i => i.type === 'image' || i.type === 'pdf').map(i => i.raw as File);

    // Update status to 'detecting' for all
    setProcessedItems(prev => prev.map(p => ({ ...p, status: 'detecting' })));

    try {
      if (urls.length > 0) await detectFromUrls(urls);
      if (images.length > 0) await detectFromImages(images);
      setPhase('results');
    } catch {
      setProcessedItems(prev =>
        prev.map(p => p.status !== 'done' ? { ...p, status: 'failed', errorMessage: 'Processing failed' } : p)
      );
    }
  };
  // ...
}

export function UnifiedImportScreen(props: UnifiedImportScreenProps) {
  return (
    <BulkImportProvider userId={props.userId}>
      <UnifiedImportInner {...props} />
    </BulkImportProvider>
  );
}
```

**Step 3: Show ProcessingView when phase === 'processing'**

```tsx
if (phase === 'processing') {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <ProcessingView
        queueItems={queue}
        processedItems={processedItems}
        onRetry={(id) => console.log('retry', id)}
      />
    </div>
  );
}
```

**Step 4: Build check**

```bash
npm run build 2>&1 | tail -5
```

**Step 5: Commit**

```bash
git add src/components/UnifiedImport/
git commit -m "feat: add ProcessingView and import trigger with BulkImportProvider"
```

---

## Task 7: Results/Summary screen

Shows each processed workout as a card. Two primary actions: "Save all to library" and "Build one workout from these" (only shown when 2+ results).

**Files:**
- Create: `src/components/UnifiedImport/ResultsScreen.tsx`
- Create: `src/components/UnifiedImport/__tests__/ResultsScreen.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/components/UnifiedImport/__tests__/ResultsScreen.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResultsScreen } from '../ResultsScreen';
import type { ProcessedItem, QueueItem } from '../../../types/unified-import';

const makeItem = (id: string, title: string): ProcessedItem => ({
  queueId: id,
  status: 'done',
  workoutTitle: title,
  blockCount: 2,
  exerciseCount: 6,
  workout: { title, blocks: [] },
});

const makeQueue = (ids: string[]): QueueItem[] =>
  ids.map(id => ({ id, type: 'url' as const, label: id, raw: id }));

describe('ResultsScreen', () => {
  it('renders one card per done item', () => {
    render(
      <ResultsScreen
        queueItems={makeQueue(['a', 'b'])}
        processedItems={[makeItem('a', 'Push Day'), makeItem('b', 'Pull Day')]}
        onSaveAll={vi.fn()}
        onBuildOne={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText('Push Day')).toBeInTheDocument();
    expect(screen.getByText('Pull Day')).toBeInTheDocument();
  });

  it('shows Build one workout button only when 2+ results', () => {
    const { rerender } = render(
      <ResultsScreen
        queueItems={makeQueue(['a'])}
        processedItems={[makeItem('a', 'Solo Day')]}
        onSaveAll={vi.fn()}
        onBuildOne={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /build one workout/i })).not.toBeInTheDocument();

    rerender(
      <ResultsScreen
        queueItems={makeQueue(['a', 'b'])}
        processedItems={[makeItem('a', 'A'), makeItem('b', 'B')]}
        onSaveAll={vi.fn()}
        onBuildOne={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /build one workout/i })).toBeInTheDocument();
  });

  it('calls onRemove when remove button is clicked', () => {
    const onRemove = vi.fn();
    render(
      <ResultsScreen
        queueItems={makeQueue(['a'])}
        processedItems={[makeItem('a', 'Push Day')]}
        onSaveAll={vi.fn()}
        onBuildOne={vi.fn()}
        onEdit={vi.fn()}
        onRemove={onRemove}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(onRemove).toHaveBeenCalledWith('a');
  });
});
```

**Step 2: Run test to verify failure**

```bash
npx vitest run src/components/UnifiedImport/__tests__/ResultsScreen.test.tsx 2>&1 | tail -10
```

Expected: `FAIL`

**Step 3: Implement ResultsScreen**

```tsx
// src/components/UnifiedImport/ResultsScreen.tsx
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Pencil, Trash2, Youtube, Image, FileText, Link, Layers } from 'lucide-react';
import { Badge } from '../ui/badge';
import type { ProcessedItem, QueueItem } from '../../types/unified-import';

interface ResultsScreenProps {
  queueItems: QueueItem[];
  processedItems: ProcessedItem[];
  onSaveAll: () => void;
  onBuildOne: () => void;
  onEdit: (queueId: string) => void;
  onRemove: (queueId: string) => void;
}

function SourceIcon({ type }: { type: QueueItem['type'] }) {
  if (type === 'pdf') return <FileText className="w-5 h-5 text-muted-foreground" />;
  if (type === 'image') return <Image className="w-5 h-5 text-muted-foreground" />;
  return <Link className="w-5 h-5 text-muted-foreground" />;
}

export function ResultsScreen({
  queueItems,
  processedItems,
  onSaveAll,
  onBuildOne,
  onEdit,
  onRemove,
}: ResultsScreenProps) {
  const doneItems = processedItems.filter(p => p.status === 'done');
  const failedItems = processedItems.filter(p => p.status === 'failed');

  return (
    <div className="space-y-6">
      {/* Primary actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button className="flex-1" onClick={onSaveAll} disabled={doneItems.length === 0}>
          Save all to library ({doneItems.length})
        </Button>
        {doneItems.length >= 2 && (
          <Button variant="outline" className="flex-1 gap-2" onClick={onBuildOne}>
            <Layers className="w-4 h-4" />
            Build one workout from these
          </Button>
        )}
      </div>

      {/* Result cards */}
      <div className="space-y-3">
        {queueItems.map(qi => {
          const processed = processedItems.find(p => p.queueId === qi.id);
          if (!processed || processed.status !== 'done') return null;
          return (
            <Card key={qi.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <SourceIcon type={qi.type} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{processed.workoutTitle ?? 'Untitled workout'}</p>
                  <p className="text-sm text-muted-foreground">
                    {processed.blockCount ?? 0} blocks · {processed.exerciseCount ?? 0} exercises
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => onEdit(qi.id)}>
                    <Pencil className="w-3 h-3" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onRemove(qi.id)} aria-label="remove">
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Failed items */}
      {failedItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">{failedItems.length} item(s) failed</p>
          {failedItems.map(p => {
            const qi = queueItems.find(q => q.id === p.queueId);
            return (
              <div key={p.queueId} className="flex items-center gap-2 p-2 rounded border border-destructive/40 text-sm">
                <span className="flex-1 truncate text-muted-foreground">{qi?.label}</span>
                <Badge variant="destructive">Failed</Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run tests to verify pass**

```bash
npx vitest run src/components/UnifiedImport/__tests__/ResultsScreen.test.tsx 2>&1 | tail -10
```

Expected: `3 passed`

**Step 5: Wire ResultsScreen into UnifiedImportScreen**

In `UnifiedImportInner`, when `phase === 'results'`:

```tsx
if (phase === 'results') {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Import Results</h1>
        <p className="text-muted-foreground mt-1">Review what was found. Save all or build a combined workout.</p>
      </div>
      <ResultsScreen
        queueItems={queue}
        processedItems={processedItems}
        onSaveAll={handleSaveAll}
        onBuildOne={() => setPhase('block-picker' as any)} // Task 8
        onEdit={(id) => console.log('edit', id)} // Task 10
        onRemove={(id) => setProcessedItems(prev => prev.filter(p => p.queueId !== id))}
      />
    </div>
  );
}
```

Add placeholder `handleSaveAll`:
```tsx
const handleSaveAll = async () => {
  // TODO: Task 9 — call saveWorkoutToHistory for each done item
  onDone();
};
```

**Step 6: Build check**

```bash
npm run build 2>&1 | tail -5
```

**Step 7: Commit**

```bash
git add src/components/UnifiedImport/
git commit -m "feat: add ResultsScreen with save all and build one actions"
```

---

## Task 8: Block picker (Frankenstein flow)

Shown when user clicks "Build one workout from these." Left column = source workout blocks to select; right column = live preview with drag-to-reorder.

**Files:**
- Create: `src/components/UnifiedImport/BlockPicker.tsx`
- Create: `src/components/UnifiedImport/__tests__/BlockPicker.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/components/UnifiedImport/__tests__/BlockPicker.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BlockPicker } from '../BlockPicker';
import type { ProcessedItem, QueueItem, SelectedBlock } from '../../../types/unified-import';

const sources: ProcessedItem[] = [
  {
    queueId: 'a',
    status: 'done',
    workoutTitle: 'Squat Day',
    workout: {
      title: 'Squat Day',
      blocks: [
        { id: 'b1', label: 'Warm-up', exercises: [] },
        { id: 'b2', label: 'Squats', exercises: [] },
      ],
    },
  },
];

const queueItems: QueueItem[] = [{ id: 'a', type: 'url', label: 'source-a', raw: 'url' }];

describe('BlockPicker', () => {
  it('renders block names from source workouts', () => {
    render(
      <BlockPicker
        queueItems={queueItems}
        processedItems={sources}
        selectedBlocks={[]}
        onSelectionChange={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Warm-up')).toBeInTheDocument();
    expect(screen.getByText('Squats')).toBeInTheDocument();
  });

  it('calls onSelectionChange when a block is clicked', () => {
    const onSelectionChange = vi.fn();
    render(
      <BlockPicker
        queueItems={queueItems}
        processedItems={sources}
        selectedBlocks={[]}
        onSelectionChange={onSelectionChange}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Warm-up'));
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ blockId: 'b1', blockLabel: 'Warm-up' }),
      ])
    );
  });

  it('disables confirm button when no blocks selected', () => {
    render(
      <BlockPicker
        queueItems={queueItems}
        processedItems={sources}
        selectedBlocks={[]}
        onSelectionChange={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /edit this workout/i })).toBeDisabled();
  });
});
```

**Step 2: Run test to verify failure**

```bash
npx vitest run src/components/UnifiedImport/__tests__/BlockPicker.test.tsx 2>&1 | tail -10
```

Expected: `FAIL`

**Step 3: Implement BlockPicker**

```tsx
// src/components/UnifiedImport/BlockPicker.tsx
import { Button } from '../ui/button';
import { Check } from 'lucide-react';
import { cn } from '../ui/utils';
import type { ProcessedItem, QueueItem, SelectedBlock } from '../../types/unified-import';

interface BlockPickerProps {
  queueItems: QueueItem[];
  processedItems: ProcessedItem[];
  selectedBlocks: SelectedBlock[];
  onSelectionChange: (blocks: SelectedBlock[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function BlockPicker({
  queueItems,
  processedItems,
  selectedBlocks,
  onSelectionChange,
  onConfirm,
  onCancel,
}: BlockPickerProps) {
  const toggle = (block: SelectedBlock) => {
    const exists = selectedBlocks.some(s => s.blockId === block.blockId);
    if (exists) {
      onSelectionChange(selectedBlocks.filter(s => s.blockId !== block.blockId));
    } else {
      onSelectionChange([...selectedBlocks, block]);
    }
  };

  const doneItems = processedItems.filter(p => p.status === 'done');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Choose blocks</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tap blocks to select them. Reorder your selection on the right.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: source blocks */}
        <div className="space-y-4">
          {doneItems.map((item, workoutIndex) => {
            const blocks = item.workout?.blocks ?? [];
            return (
              <div key={item.queueId}>
                <p className="text-sm font-medium text-muted-foreground mb-2">{item.workoutTitle}</p>
                <div className="space-y-1">
                  {blocks.map((block: { id: string; label: string }, blockIndex: number) => {
                    const isSelected = selectedBlocks.some(s => s.blockId === block.id);
                    return (
                      <button
                        key={block.id}
                        onClick={() =>
                          toggle({ workoutIndex, blockIndex, blockId: block.id, blockLabel: block.label ?? 'Block' })
                        }
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-md border text-sm flex items-center gap-2 transition-colors',
                          isSelected
                            ? 'border-primary bg-primary/10 font-medium'
                            : 'border-border hover:bg-muted/50'
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3 text-primary shrink-0" />}
                        {block.label ?? `Block ${blockIndex + 1}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: selected preview */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Selected ({selectedBlocks.length})
          </p>
          {selectedBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No blocks selected yet</p>
          ) : (
            selectedBlocks.map((s, idx) => (
              <div
                key={s.blockId}
                className="px-3 py-2 rounded-md border bg-muted/30 text-sm flex items-center gap-2"
              >
                <span className="text-muted-foreground">{idx + 1}.</span>
                <span>{s.blockLabel}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={selectedBlocks.length === 0}
          className="flex-1"
        >
          Edit this workout ({selectedBlocks.length} blocks)
        </Button>
      </div>
    </div>
  );
}
```

**Step 4: Run tests to verify pass**

```bash
npx vitest run src/components/UnifiedImport/__tests__/BlockPicker.test.tsx 2>&1 | tail -10
```

Expected: `3 passed`

**Step 5: Wire BlockPicker into UnifiedImportScreen**

Add `'block-picker'` to the phase states and render `BlockPicker` when active. `onConfirm` will eventually open the StructureWorkout editor (Task 10). For now, log the selection:

```tsx
const [selectedBlocks, setSelectedBlocks] = useState<SelectedBlock[]>([]);

// In phase === 'block-picker' render:
return (
  <div className="container mx-auto px-4 py-8 max-w-3xl">
    <BlockPicker
      queueItems={queue}
      processedItems={processedItems}
      selectedBlocks={selectedBlocks}
      onSelectionChange={setSelectedBlocks}
      onConfirm={() => console.log('TODO: open editor with', selectedBlocks)} // Task 10
      onCancel={() => setPhase('results')}
    />
  </div>
);
```

**Step 6: Build check**

```bash
npm run build 2>&1 | tail -5
```

**Step 7: Commit**

```bash
git add src/components/UnifiedImport/
git commit -m "feat: add BlockPicker for building Frankenstein workouts"
```

---

## Task 9: Save all to library

Wire `handleSaveAll` to actually save each processed workout using `saveWorkoutToHistory`.

**Files:**
- Modify: `src/components/UnifiedImport/UnifiedImportScreen.tsx`

**Step 1: Update handleSaveAll in UnifiedImportInner**

```tsx
import { saveWorkoutToHistory } from '../../lib/workout-history';
import { toast } from 'sonner';

const handleSaveAll = async () => {
  const doneItems = processedItems.filter(p => p.status === 'done' && p.workout);
  let saved = 0;
  let failed = 0;

  for (const item of doneItems) {
    try {
      await saveWorkoutToHistory(userId, item.workout, 'none');
      saved++;
    } catch {
      failed++;
    }
  }

  if (failed === 0) {
    toast.success(`${saved} workout${saved !== 1 ? 's' : ''} saved to your library`);
  } else {
    toast.warning(`${saved} saved, ${failed} failed`);
  }

  onDone(); // navigate to workouts library
};
```

**Step 2: Build check**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in X.XXs`

**Step 3: Manual smoke test**

Run `npm run dev`, click Import, paste a YouTube URL, hit Import, wait for processing, click "Save all to library" — verify a toast appears and the app navigates to the workouts view.

**Step 4: Commit**

```bash
git add src/components/UnifiedImport/UnifiedImportScreen.tsx
git commit -m "feat: wire save-all to saveWorkoutToHistory"
```

---

## Task 10: File tab — reuse MapStep column matching

The File tab uploads Excel/CSV/JSON, runs column matching (existing `MapStep` logic), then flows into the same results screen.

**Files:**
- Create: `src/components/UnifiedImport/FileImportTab.tsx`
- Modify: `src/components/UnifiedImport/UnifiedImportScreen.tsx`

**Step 1: Create FileImportTab**

The `MapStep` component from the existing bulk import already handles the column mapping UI. We reuse `BulkImportContext` state (which we already wrap `UnifiedImportScreen` with) and the same `useBulkImportApi`.

```tsx
// src/components/UnifiedImport/FileImportTab.tsx
import { useRef, useCallback } from 'react';
import { Button } from '../ui/button';
import { Upload } from 'lucide-react';
import { useBulkImport } from '../../context/BulkImportContext';
import { useBulkImportApi } from '../../hooks/useBulkImportApi';

interface FileImportTabProps {
  userId: string;
  onFilesDetected: () => void; // callback to switch to column-mapping phase
}

export function FileImportTab({ userId, onFilesDetected }: FileImportTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { detectFromFiles } = useBulkImportApi({ userId });
  const { state } = useBulkImport();

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    await detectFromFiles(files);
    onFilesDetected();
  }, [detectFromFiles, onFilesDetected]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload an Excel, CSV, or JSON file. You'll match columns before importing.
      </p>

      <div
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          handleFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium">Drop files here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">Excel (.xlsx, .xls), CSV, JSON</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.json,.txt"
          multiple
          className="hidden"
          onChange={e => handleFiles(Array.from(e.target.files ?? []))}
        />
      </div>
    </div>
  );
}
```

**Step 2: Add file import phase to UnifiedImportScreen**

Add `'column-mapping'` phase. When `onFilesDetected` fires, switch to `'column-mapping'` and render the existing `MapStep`:

```tsx
import { MapStep } from '../BulkImport/MapStep';

// In UnifiedImportInner, add phase handling:
if (phase === 'column-mapping') {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Match Columns</h1>
      <MapStep userId={userId} />
      <div className="mt-4">
        <Button onClick={() => setPhase('results')}>Continue to Results</Button>
      </div>
    </div>
  );
}

// In the file TabsContent:
<TabsContent value="file">
  <FileImportTab
    userId={userId}
    onFilesDetected={() => setPhase('column-mapping')}
  />
</TabsContent>
```

**Step 3: Build check**

```bash
npm run build 2>&1 | tail -5
```

**Step 4: Commit**

```bash
git add src/components/UnifiedImport/
git commit -m "feat: add File tab with column matching via existing MapStep"
```

---

## Task 11: Integrations tab (mocked)

Shows integration tiles clearly marked as "coming soon." No functionality — just the placeholder UI.

**Files:**
- Create: `src/components/UnifiedImport/IntegrationsTab.tsx`
- Modify: `src/components/UnifiedImport/UnifiedImportScreen.tsx`

**Step 1: Create IntegrationsTab**

```tsx
// src/components/UnifiedImport/IntegrationsTab.tsx
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Plug } from 'lucide-react';

const INTEGRATIONS = [
  { name: 'Notion', description: 'Import workouts from Notion databases', icon: '📓' },
  { name: 'Strava', description: 'Pull activities from your Strava account', icon: '🚴' },
  { name: 'Garmin Connect', description: 'Import from Garmin workout library', icon: '⌚' },
  { name: 'FIT / TCX files', description: 'Upload Garmin or device export files', icon: '📁' },
  { name: 'Browser Clip Queue', description: 'URLs clipped via browser extension appear here', icon: '🔗' },
];

export function IntegrationsTab() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Connect external tools and services. Imported workouts flow into the same results screen.
      </p>
      {INTEGRATIONS.map(integration => (
        <Card key={integration.name} className="opacity-60 cursor-not-allowed">
          <CardContent className="flex items-center gap-4 p-4">
            <span className="text-2xl">{integration.icon}</span>
            <div className="flex-1">
              <p className="font-medium text-sm">{integration.name}</p>
              <p className="text-xs text-muted-foreground">{integration.description}</p>
            </div>
            <Badge variant="secondary">Coming soon</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**Step 2: Wire into UnifiedImportScreen**

In the `TabsContent value="integrations"`:
```tsx
import { IntegrationsTab } from './IntegrationsTab';

<TabsContent value="integrations">
  <IntegrationsTab />
</TabsContent>
```

**Step 3: Build check**

```bash
npm run build 2>&1 | tail -5
```

**Step 4: Commit**

```bash
git add src/components/UnifiedImport/
git commit -m "feat: add Integrations tab with coming-soon tiles"
```

---

## Task 12: Run full test suite + E2E verification

**Step 1: Run unit tests**

```bash
npm run test:run 2>&1 | tail -10
```

Expected: all new `UnifiedImport` tests pass. Pre-existing failures should be same or fewer as before starting this work (11 pre-existing failures documented in plan header).

**Step 2: Run Playwright E2E suite**

```bash
python /tmp/test_structure_workout.py
```

Expected: 55/55 pass (the StructureWorkout tests should be unaffected).

**Step 3: Manual walkthrough checklist**

- [ ] Click Import in nav → lands on unified import screen with 3 tabs
- [ ] Paste a YouTube URL → appears in queue
- [ ] Paste 3 URLs at once (newline-separated) → 3 items in queue
- [ ] Add an image → appears in queue alongside URLs
- [ ] Click Import → processing view with per-item status
- [ ] After processing → results screen with workout cards
- [ ] Single result: only "Save all to library" shown (no Build one)
- [ ] Multiple results: both buttons shown
- [ ] Click "Save all to library" → toast + navigate to workouts
- [ ] Click "Build one workout from these" → block picker
- [ ] Select blocks → Edit this workout button enables
- [ ] File tab → drag/drop file → column mapping → results screen
- [ ] Integrations tab → tiles marked "coming soon"

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: unified import flow complete — replaces Single Import and Bulk Import"
```
