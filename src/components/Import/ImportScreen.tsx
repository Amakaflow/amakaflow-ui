import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Link, FileSpreadsheet, Bookmark, Plug } from 'lucide-react';
import { useImportFlow } from './hooks/useImportFlow';
import { FileImportTab } from './FileImportTab';
import { ImportQueue } from './ImportQueue';
import { ProcessingView } from './ProcessingView';
import { ResultsScreen } from './ResultsScreen';
import { BlockPicker } from './BlockPicker';
import { ClipQueueTab } from './ClipQueueTab';
import { IntegrationsTab } from './IntegrationsTab';
import { MapStep } from '../BulkImport/MapStep';
import type { QueueItem } from '../../types/import';
import type { ReactNode } from 'react';
interface ImportScreenProps { userId: string; onDone: () => void; onEditWorkout: (w: Record<string, unknown>) => void; }
const wrap = (children: ReactNode) => <div className="container mx-auto px-4 py-8 max-w-3xl">{children}</div>;

export function ImportScreen({ userId, onDone, onEditWorkout }: ImportScreenProps) {
  const { phase, activeTab, setActiveTab, queue, addUrls, addFiles, removeQueueItem,
    processedItems, selectedBlocks, setSelectedBlocks, columnMappingState,
    handleImport, handleSaveAll, handleRetry, handleRemoveResult,
    handleFilesDetected, handleColumnMappingComplete, goToBlockPicker,
    cancelBlockPicker, handleBlockPickerConfirm } = useImportFlow({ userId, onDone, onEditWorkout });

  const handleQueueChange = (next: QueueItem[]) => {
    queue.forEach(i => { if (!next.find(q => q.id === i.id)) removeQueueItem(i.id); });
    const added = next.filter(i => !queue.find(q => q.id === i.id));
    const urls = added.filter(i => i.type === 'url').map(i => i.raw as string);
    const files = added.filter(i => i.type === 'image' || i.type === 'pdf').map(i => i.raw as File);
    if (urls.length) addUrls(urls.join('\n')); if (files.length) addFiles(files);
  };
  if (phase === 'processing') return wrap(<ProcessingView queueItems={queue} processedItems={processedItems} onRetry={handleRetry} />);

  if (phase === 'results') return wrap(<>
    <div className="mb-6"><h1 className="text-2xl font-bold">Import Results</h1>
      <p className="text-muted-foreground mt-1">Review what was found. Save all or build a combined workout.</p></div>
    <ResultsScreen queueItems={queue} processedItems={processedItems} onSaveAll={handleSaveAll}
      onBuildOne={goToBlockPicker} onRemove={handleRemoveResult}
      onEdit={(id) => { const i = processedItems.find(p => p.queueId === id); if (i?.workout) onEditWorkout(i.workout); }} />
  </>);

  if (phase === 'block-picker') return wrap(<>
    <div className="mb-6"><h1 className="text-2xl font-bold">Build one workout</h1>
      <p className="text-muted-foreground mt-1">Choose the blocks you want, then edit and save.</p></div>
    <BlockPicker queueItems={queue} processedItems={processedItems} selectedBlocks={selectedBlocks}
      onSelectionChange={setSelectedBlocks} onCancel={cancelBlockPicker}
      onConfirm={() => {
        const done = processedItems.filter(p => p.status === 'done');
        const blocks = selectedBlocks.map(s => done[s.workoutIndex]?.workout?.blocks?.[s.blockIndex]).filter(Boolean);
        handleBlockPickerConfirm({ title: 'Combined Workout', blocks });
      }} />
  </>);

  if (phase === 'column-mapping' && columnMappingState) return wrap(<><h1 className="text-2xl font-bold mb-6">Match Columns</h1>
    <MapStep userId={userId} columns={columnMappingState.columns} patterns={columnMappingState.patterns}
      loading={columnMappingState.loading} onApply={(cols) => { void handleColumnMappingComplete(cols); }} /></>);

  return wrap(
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
      <div className="mb-6"><h1 className="text-2xl font-bold">Import Workouts</h1>
        <p className="text-muted-foreground mt-1">Add one or many sources — the rest is handled for you.</p></div>
      <TabsList className="mb-6">
        <TabsTrigger value="urls-media" className="gap-2"><Link className="w-4 h-4" />URLs &amp; Media</TabsTrigger>
        <TabsTrigger value="file" className="gap-2"><FileSpreadsheet className="w-4 h-4" />File</TabsTrigger>
        <TabsTrigger value="clip-queue" className="gap-2"><Bookmark className="w-4 h-4" />Clip Queue</TabsTrigger>
        <TabsTrigger value="integrations" className="gap-2"><Plug className="w-4 h-4" />Integrations</TabsTrigger>
      </TabsList>
      <TabsContent value="urls-media">
        <ImportQueue queue={queue} onQueueChange={handleQueueChange} />
        {queue.length > 0 && <div className="mt-4">
          <Button className="w-full" onClick={handleImport}>Import {queue.length} item{queue.length !== 1 ? 's' : ''}</Button>
        </div>}
      </TabsContent>
      <TabsContent value="file"><FileImportTab onFilesDetected={handleFilesDetected} /></TabsContent>
      <TabsContent value="clip-queue"><ClipQueueTab /></TabsContent>
      <TabsContent value="integrations"><IntegrationsTab /></TabsContent>
    </Tabs>
  );
}
