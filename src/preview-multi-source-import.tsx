/**
 * AMA-1180: Standalone preview entry point for multi-source import flow.
 * Served at /multi-source-import-preview.html during dev.
 *
 * Renders the full multi-source import flow in demo mode for Playwright screenshots.
 */

import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { MultiSourceImport } from './components/Import/MultiSourceImport';
import { BlockPicker } from './components/Import/BlockPicker';
import { FollowAlongMergePlayer, type MergedBlock } from './components/Import/FollowAlongMergePlayer';
import {
  DEMO_QUEUE_ITEMS,
  DEMO_PROCESSED_ITEMS,
  DEMO_VIDEO_SEGMENTS,
  PLATFORM_LABELS,
  type SourcePlatform,
} from './components/Import/fixtures/multi-source-demo';
import type { QueueItem, ProcessedItem, SelectedBlock } from './types/import';

type DemoPhase = 'import' | 'block-picker' | 'player';

function MultiSourceImportDemo() {
  const [phase, setPhase] = useState<DemoPhase>('import');
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [processedItems, setProcessedItems] = useState<ProcessedItem[]>([]);
  const [selectedBlocks, setSelectedBlocks] = useState<SelectedBlock[]>([]);

  const handleImportComplete = (qi: QueueItem[], pi: ProcessedItem[]) => {
    setQueueItems(qi);
    setProcessedItems(pi);
    setPhase('block-picker');
  };

  const handleBlockPickerConfirm = () => {
    setPhase('player');
  };

  // Build merged blocks for the player from selected blocks
  const mergedBlocks: MergedBlock[] = selectedBlocks
    .map(sel => {
      const done = processedItems.filter(p => p.status === 'done');
      const item = done[sel.workoutIndex];
      if (!item?.workout) return null;
      const block = (item.workout.blocks as Array<{
        id: string;
        label?: string;
        exercises?: Array<{ name: string; sets?: number; reps?: number | string; duration_sec?: number }>;
      }>)?.[sel.blockIndex];
      if (!block) return null;

      const platform = (item.sourceIcon as SourcePlatform) ?? 'youtube';
      const sourceUrl = (item.workout.sourceUrl as string) ?? '';

      return {
        id: block.id,
        label: block.label ?? `Block ${sel.blockIndex + 1}`,
        sourcePlatform: platform,
        sourceUrl,
        videoSegment: DEMO_VIDEO_SEGMENTS[block.id],
        exercises: block.exercises ?? [],
      };
    })
    .filter((b): b is MergedBlock => b !== null);

  return (
    <div className="dark bg-background text-foreground min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-3xl" data-testid="multi-source-demo">
        {/* Phase navigation for demo */}
        <div className="flex gap-2 mb-6 pb-4 border-b">
          {(['import', 'block-picker', 'player'] as DemoPhase[]).map(p => (
            <button
              key={p}
              onClick={() => setPhase(p)}
              className={`px-3 py-1 rounded text-sm ${
                phase === p
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
              data-testid={`phase-${p}`}
            >
              {p === 'import' ? '1. Import' : p === 'block-picker' ? '2. Pick Blocks' : '3. Player'}
            </button>
          ))}
        </div>

        {phase === 'import' && (
          <MultiSourceImport
            onImportComplete={handleImportComplete}
            demoQueueItems={DEMO_QUEUE_ITEMS}
            demoProcessedItems={DEMO_PROCESSED_ITEMS}
          />
        )}

        {phase === 'block-picker' && (
          <BlockPicker
            queueItems={queueItems.length > 0 ? queueItems : DEMO_QUEUE_ITEMS}
            processedItems={processedItems.length > 0 ? processedItems : DEMO_PROCESSED_ITEMS}
            selectedBlocks={selectedBlocks}
            onSelectionChange={setSelectedBlocks}
            onConfirm={handleBlockPickerConfirm}
            onCancel={() => setPhase('import')}
          />
        )}

        {phase === 'player' && (
          <FollowAlongMergePlayer
            workoutTitle="Custom Mixed-Source Workout"
            blocks={mergedBlocks.length > 0 ? mergedBlocks : buildDemoMergedBlocks()}
            onClose={() => setPhase('block-picker')}
          />
        )}
      </div>
    </div>
  );
}

// Build demo merged blocks for the player when no selection has been made
function buildDemoMergedBlocks(): MergedBlock[] {
  return DEMO_PROCESSED_ITEMS.filter(p => p.status === 'done').flatMap(item => {
    const blocks = (item.workout?.blocks ?? []) as Array<{
      id: string;
      label?: string;
      exercises?: Array<{ name: string; sets?: number; reps?: number | string; duration_sec?: number }>;
    }>;
    const platform = (item.sourceIcon as SourcePlatform) ?? 'youtube';
    const sourceUrl = (item.workout?.sourceUrl as string) ?? '';
    return blocks.map(block => ({
      id: block.id,
      label: block.label ?? 'Block',
      sourcePlatform: platform,
      sourceUrl,
      videoSegment: DEMO_VIDEO_SEGMENTS[block.id],
      exercises: block.exercises ?? [],
    }));
  });
}

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(<MultiSourceImportDemo />);
}
