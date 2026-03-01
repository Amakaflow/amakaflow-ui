import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Link, FileSpreadsheet, Plug } from 'lucide-react';
import { ImportQueue } from './ImportQueue';
import { ProcessingView } from './ProcessingView';
import { BulkImportProvider, useBulkImport } from '../../context/BulkImportContext';
import { useBulkImportApi } from '../../hooks/useBulkImportApi';
import type {
  ImportTab,
  QueueItem,
  ProcessedItem,
  SelectedBlock,
} from '../../types/unified-import';

interface UnifiedImportScreenProps {
  userId: string;
  onDone: () => void;
}

type Phase = 'input' | 'processing' | 'results' | 'block-picker';

// Inner component has access to BulkImportContext
function UnifiedImportInner({ userId, onDone }: UnifiedImportScreenProps) {
  const [activeTab, setActiveTab] = useState<ImportTab>('urls-media');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [processedItems, setProcessedItems] = useState<ProcessedItem[]>([]);
  const [phase, setPhase] = useState<Phase>('input');
  const [selectedBlocks, setSelectedBlocks] = useState<SelectedBlock[]>([]);

  const { state } = useBulkImport();
  const { detectFromUrls, detectFromImages } = useBulkImportApi({ userId });

  const handleImport = async () => {
    setPhase('processing');

    const initial: ProcessedItem[] = queue.map(item => ({
      queueId: item.id,
      status: 'pending',
    }));
    setProcessedItems(initial);

    const urlItems = queue.filter(i => i.type === 'url');
    const mediaItems = queue.filter(i => i.type === 'image' || i.type === 'pdf');
    const urls = urlItems.map(i => i.raw as string);
    const files = mediaItems.map(i => i.raw as File);

    // Mark all as detecting
    setProcessedItems(prev => prev.map(p => ({ ...p, status: 'detecting' })));

    try {
      if (urls.length > 0) await detectFromUrls(urls);
      if (files.length > 0) await detectFromImages(files);

      // Map detected items from context back to queue items by position
      const detectedItems = state.detected.items;
      setProcessedItems(
        queue.map((qItem, idx) => {
          const detected = detectedItems[idx];
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
          p.status !== 'done' ? { ...p, status: 'failed', errorMessage: 'Processing failed' } : p
        )
      );
    }
  };

  const handleRetry = (queueId: string) => {
    setProcessedItems(prev =>
      prev.map(p => (p.queueId === queueId ? { ...p, status: 'pending', errorMessage: undefined } : p))
    );
    // TODO: retry individual item
  };

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

  if (phase === 'results') {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Import Results</h1>
          <p className="text-muted-foreground mt-1">
            Review what was found. Save all or build a combined workout.
          </p>
        </div>
        {/* ResultsScreen rendered in Task 7 */}
        <pre className="text-xs text-muted-foreground">
          {processedItems.length} items processed
        </pre>
      </div>
    );
  }

  if (phase === 'block-picker') {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* BlockPicker rendered in Task 8 */}
        <p className="text-muted-foreground">Block picker — coming soon</p>
      </div>
    );
  }

  // phase === 'input'
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
          <p className="text-muted-foreground">File import — coming soon</p>
        </TabsContent>

        <TabsContent value="integrations">
          <p className="text-muted-foreground">Integrations — coming soon</p>
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
