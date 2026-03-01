import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Link, FileSpreadsheet, Plug, Bookmark } from 'lucide-react';
import { toast } from 'sonner';
import { ImportQueue } from './ImportQueue';
import { ProcessingView } from './ProcessingView';
import { ResultsScreen } from './ResultsScreen';
import { BlockPicker } from './BlockPicker';
import { FileImportTab } from './FileImportTab';
import { IntegrationsTab } from './IntegrationsTab';
import { ClipQueueTab } from './ClipQueueTab';
import { MapStep } from '../BulkImport/MapStep';
import { BulkImportProvider } from '../../context/BulkImportContext';
import { bulkImportApi, fileToBase64 } from '../../lib/bulk-import-api';
import { saveWorkoutToHistory } from '../../lib/workout-history';
import type { DetectedItem, ColumnMapping, DetectedPattern } from '../../types/bulk-import';
import type {
  ImportTab,
  QueueItem,
  ProcessedItem,
  SelectedBlock,
} from '../../types/unified-import';

interface UnifiedImportScreenProps {
  userId: string;
  onDone: () => void;
  onEditWorkout?: (workout: Record<string, unknown>) => void;
}

type Phase = 'input' | 'processing' | 'results' | 'block-picker' | 'column-mapping';

// Inner component has access to BulkImportContext
function UnifiedImportInner({ userId, onDone, onEditWorkout }: UnifiedImportScreenProps) {
  const [activeTab, setActiveTab] = useState<ImportTab>('urls-media');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [processedItems, setProcessedItems] = useState<ProcessedItem[]>([]);
  const [phase, setPhase] = useState<Phase>('input');
  const [selectedBlocks, setSelectedBlocks] = useState<SelectedBlock[]>([]);
  const [mappingColumns, setMappingColumns] = useState<ColumnMapping[]>([]);
  const [mappingPatterns, setMappingPatterns] = useState<DetectedPattern[]>([]);
  const [mappingLoading, setMappingLoading] = useState(false);

  const handleImport = async () => {
    setPhase('processing');
    setProcessedItems(queue.map(item => ({ queueId: item.id, status: 'pending' })));
    setProcessedItems(prev => prev.map(p => ({ ...p, status: 'detecting' })));

    try {
      // Call the API directly so we can use the response immediately — avoids the
      // stale-closure problem that arises when reading BulkImportContext state
      // after dispatching to it (React doesn't re-render mid-async-function).
      const allDetected: DetectedItem[] = [];

      const urlItems = queue.filter(i => i.type === 'url');
      if (urlItems.length > 0) {
        const urls = urlItems.map(i => i.raw as string);
        const response = await bulkImportApi.detect(userId, 'urls', urls);
        allDetected.push(...response.items);
      }

      const mediaItems = queue.filter(i => i.type === 'image' || i.type === 'pdf');
      if (mediaItems.length > 0) {
        const base64s = await Promise.all(mediaItems.map(i => fileToBase64(i.raw as File)));
        const response = await bulkImportApi.detect(userId, 'images', base64s);
        allDetected.push(...response.items);
      }

      setProcessedItems(
        queue.map((qItem, idx) => {
          const detected = allDetected[idx];
          if (!detected) {
            return { queueId: qItem.id, status: 'failed', errorMessage: 'No result returned' };
          }
          if (detected.errors?.length) {
            return { queueId: qItem.id, status: 'failed', errorMessage: detected.errors[0] };
          }
          return {
            queueId: qItem.id,
            status: 'done',
            workoutTitle: detected.parsedTitle ?? 'Untitled workout',
            blockCount: detected.parsedBlockCount ?? 0,
            exerciseCount: detected.parsedExerciseCount ?? 0,
            workout: detected.rawData,
          };
        })
      );
      setPhase('results');
    } catch {
      setProcessedItems(prev =>
        prev.map(p =>
          p.status !== 'done'
            ? { ...p, status: 'failed', errorMessage: 'Processing failed' }
            : p
        )
      );
    }
  };

  const handleRetry = (queueId: string) => {
    setProcessedItems(prev =>
      prev.map(p =>
        p.queueId === queueId ? { ...p, status: 'pending', errorMessage: undefined } : p
      )
    );
    // TODO: retry individual item — re-trigger import for this single item
  };

  const handleSaveAll = async () => {
    const doneItems = processedItems.filter(p => p.status === 'done' && p.workout);
    let saved = 0;
    let failed = 0;

    for (const item of doneItems) {
      try {
        // Use 'garmin' as device placeholder — workouts in the library are device-agnostic.
        // Device-specific behaviour is resolved when exporting (future flow).
        await saveWorkoutToHistory(userId, item.workout, 'garmin');
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

    onDone();
  };

  const handleRemoveResult = (queueId: string) => {
    setProcessedItems(prev => prev.filter(p => p.queueId !== queueId));
  };

  // ── handleFilesDetected ────────────────────────────────────────────────────
  //
  // Called by the pure FileImportTab presenter with the selected files.
  // Runs detectFile to get column info, populates mapping state, then
  // transitions to 'column-mapping' phase.

  const handleFilesDetected = async (files: File[]) => {
    if (files.length === 0) return;

    setMappingLoading(true);
    try {
      const response = await bulkImportApi.detectFile(userId, files[0]);
      const firstItem = response.items[0];

      if (firstItem?.raw_data?.column_info) {
        const columns: ColumnMapping[] = firstItem.raw_data.column_info.map(
          (col: { name: string; index: number; detected_type: string | null; confidence: number; sample_values?: string[] }, idx: number) => ({
            sourceColumn: col.name || `Column ${idx + 1}`,
            sourceColumnIndex: col.index ?? idx,
            targetField: col.detected_type || 'ignore',
            confidence: col.confidence || 0,
            userOverride: false,
            sampleValues: col.sample_values || [],
          })
        );
        setMappingColumns(columns);
        setMappingPatterns(firstItem.patterns || []);
      } else {
        setMappingColumns([]);
        setMappingPatterns([]);
      }
    } catch {
      setMappingColumns([]);
      setMappingPatterns([]);
    } finally {
      setMappingLoading(false);
    }

    setPhase('column-mapping');
  };

  // ── Phase: processing ──────────────────────────────────────────────────────

  if (phase === 'processing') {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <ProcessingView
          queueItems={queue}
          processedItems={processedItems}
          onRetry={handleRetry}
        />
      </div>
    );
  }

  // ── Phase: results ─────────────────────────────────────────────────────────

  if (phase === 'results') {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Import Results</h1>
          <p className="text-muted-foreground mt-1">
            Review what was found. Save all or build a combined workout.
          </p>
        </div>
        <ResultsScreen
          queueItems={queue}
          processedItems={processedItems}
          onSaveAll={handleSaveAll}
          onBuildOne={() => setPhase('block-picker')}
          onEdit={(id) => {
            const item = processedItems.find(p => p.queueId === id);
            if (item?.workout && onEditWorkout) onEditWorkout(item.workout);
          }}
          onRemove={handleRemoveResult}
        />
      </div>
    );
  }

  // ── Phase: block-picker ────────────────────────────────────────────────────

  if (phase === 'block-picker') {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Build one workout</h1>
          <p className="text-muted-foreground mt-1">
            Choose the blocks you want, then edit and save.
          </p>
        </div>
        <BlockPicker
          queueItems={queue}
          processedItems={processedItems}
          selectedBlocks={selectedBlocks}
          onSelectionChange={setSelectedBlocks}
          onConfirm={() => {
            const doneItems = processedItems.filter(p => p.status === 'done');
            const blocks = selectedBlocks
              .map(sel => doneItems[sel.workoutIndex]?.workout?.blocks?.[sel.blockIndex])
              .filter(Boolean);
            const combinedWorkout = { title: 'Combined Workout', blocks };
            if (onEditWorkout) onEditWorkout(combinedWorkout);
          }}
          onCancel={() => setPhase('results')}
        />
      </div>
    );
  }

  // ── Phase: column-mapping (File tab) ──────────────────────────────────────

  if (phase === 'column-mapping') {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-2xl font-bold mb-6">Match Columns</h1>
        <MapStep
          userId={userId}
          columns={mappingColumns}
          patterns={mappingPatterns}
          loading={mappingLoading}
          onApply={(_columns) => {
            setMappingLoading(false);
            setPhase('results');
          }}
        />
      </div>
    );
  }

  // ── Phase: input ───────────────────────────────────────────────────────────

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
          <TabsTrigger value="clip-queue" className="gap-2">
            <Bookmark className="w-4 h-4" />
            Clip Queue
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Plug className="w-4 h-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="urls-media">
          <ImportQueue queue={queue} onQueueChange={setQueue} />
          {queue.length > 0 && (
            <div className="mt-4">
              <Button className="w-full" onClick={handleImport}>
                Import {queue.length} item{queue.length !== 1 ? 's' : ''}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="file">
          <FileImportTab
            onFilesDetected={handleFilesDetected}
          />
        </TabsContent>

        <TabsContent value="clip-queue">
          <ClipQueueTab />
        </TabsContent>

        <TabsContent value="integrations">
          <IntegrationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function UnifiedImportScreen(props: UnifiedImportScreenProps) {
  return (
    <BulkImportProvider userId={props.userId}>
      <UnifiedImportInner {...props} />
    </BulkImportProvider>
  );
}
