/**
 * ProgressPreview — standalone preview page with simulated progress animation.
 * Part of AMA-1154 Live Progress View.
 */

import { useState } from 'react';
import { Button } from '../ui/button';
import { ProgressProvider, useProgress } from './ProgressContext';
import { GENERATE_WEEK_STEPS, PLATFORM_SYNC_STEPS, BATCH_PUSH_STEPS } from './demo-steps';

function PreviewContent() {
  const { startProgress, isProgressActive } = useProgress();
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleGenerate = () => {
    setLastResult(null);
    startProgress('demo-generate-week', 'Generating your week', GENERATE_WEEK_STEPS);
  };

  const handleSync = () => {
    setLastResult(null);
    startProgress('demo-platform-sync', 'Syncing with Strava', PLATFORM_SYNC_STEPS);
  };

  const handleBatchPush = () => {
    setLastResult(null);
    startProgress('demo-batch-push', 'Pushing workouts to Garmin', BATCH_PUSH_STEPS);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-center space-y-2 mb-4">
        <h1 className="text-2xl font-bold" data-testid="preview-title">
          Live Progress View
        </h1>
        <p className="text-muted-foreground text-sm max-w-md">
          AMA-1154: Perplexity-style live progress overlay for complex multi-step operations.
          Click a button below to see the progress animation.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={handleGenerate}
          disabled={isProgressActive}
          data-testid="demo-generate-btn"
          size="lg"
        >
          Generate my week
        </Button>
        <Button
          onClick={handleSync}
          disabled={isProgressActive}
          variant="secondary"
          data-testid="demo-sync-btn"
          size="lg"
        >
          Platform sync
        </Button>
        <Button
          onClick={handleBatchPush}
          disabled={isProgressActive}
          variant="outline"
          data-testid="demo-batch-btn"
          size="lg"
        >
          Batch push
        </Button>
      </div>

      {lastResult && (
        <p className="text-sm text-muted-foreground mt-4">{lastResult}</p>
      )}
    </div>
  );
}

export function ProgressPreview() {
  return (
    <ProgressProvider demo demoStepDelayMs={1200}>
      <PreviewContent />
    </ProgressProvider>
  );
}
