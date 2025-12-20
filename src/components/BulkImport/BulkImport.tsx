/**
 * BulkImport Component
 *
 * Main container for the bulk import workflow.
 * Orchestrates the 5-step flow: Detect -> Map -> Match -> Preview -> Import
 */

import { useCallback, useEffect } from 'react';
import { BulkImportProvider, useBulkImport } from '../../context/BulkImportContext';
import { useBulkImportApi } from '../../hooks/useBulkImportApi';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { ArrowLeft, ArrowRight, X, Loader2 } from 'lucide-react';
import { cn } from '../ui/utils';
import type { BulkInputType } from '../../types/bulk-import';

// Step Components
import { StepProgressBar } from './StepProgressBar';
import { DetectStep } from './DetectStep';
import { MapStep } from './MapStep';
import { MatchStep } from './MatchStep';
import { PreviewStep } from './PreviewStep';
import { ImportStep } from './ImportStep';

interface BulkImportProps {
  userId: string;
  onBack?: () => void;
  onViewCalendar?: () => void;
  onViewPrograms?: () => void;
  /** Initial input type to start with (file, urls, or images) */
  initialInputType?: BulkInputType;
}

/**
 * Step descriptions for header
 */
const stepDescriptions: Record<string, { title: string; description: string }> = {
  detect: {
    title: 'Select Source',
    description: 'Upload files, paste URLs, or add images to import workouts',
  },
  map: {
    title: 'Map Columns',
    description: 'Match your file columns to workout fields',
  },
  match: {
    title: 'Match Exercises',
    description: 'Confirm exercise matches with Garmin database',
  },
  preview: {
    title: 'Preview Import',
    description: 'Review workouts before importing',
  },
  import: {
    title: 'Import',
    description: 'Importing your workouts...',
  },
};

/**
 * Get contextual loading message based on current step and input type
 */
function getLoadingMessage(step: string, inputType: BulkInputType | null): string {
  if (step === 'detect') {
    switch (inputType) {
      case 'urls':
        return 'Extracting workouts from URLs (this may take a minute for Pinterest)...';
      case 'images':
        return 'Analyzing images with AI vision...';
      case 'file':
        return 'Parsing file contents...';
      default:
        return 'Processing...';
    }
  }
  if (step === 'match') {
    return 'Matching exercises to Garmin database...';
  }
  if (step === 'preview') {
    return 'Generating workout preview...';
  }
  if (step === 'import') {
    return 'Importing workouts to your account...';
  }
  return 'Processing...';
}

/**
 * Main content component (uses context)
 */
function BulkImportContent({
  userId,
  onBack,
  onViewCalendar,
  onViewPrograms,
  initialInputType,
}: BulkImportProps) {
  const { state, goNext, goBack, canGoNext, canGoBack, reset, setInputType } = useBulkImport();
  const { executeImport } = useBulkImportApi({ userId });

  // Set initial input type on mount
  useEffect(() => {
    if (initialInputType) {
      setInputType(initialInputType);
    }
  }, [initialInputType, setInputType]);

  const stepInfo = stepDescriptions[state.step];
  const isImportStep = state.step === 'import';
  const isImportRunning = state.import.status === 'running';
  const isImportComplete = ['complete', 'failed', 'cancelled'].includes(state.import.status);

  // Handle starting the import
  const handleStartImport = useCallback(async () => {
    // TODO: Add device selection UI
    await executeImport('EDGE_1040', true);
  }, [executeImport]);

  // Handle reset
  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between py-4 px-1">
        <div className="flex items-center gap-4">
          {/* Only show back button when there's a previous step */}
          {!isImportRunning && canGoBack() && (
            <Button
              variant="ghost"
              size="sm"
              onClick={goBack}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
          )}
          <div>
            <h1 className="text-xl font-semibold">
              {stepInfo.title}
              {state.loading && (
                <Loader2 className="inline-block w-5 h-5 ml-2 animate-spin text-muted-foreground" />
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              {state.loading ? getLoadingMessage(state.step, state.inputType) : stepInfo.description}
            </p>
          </div>
        </div>
        {!isImportRunning && !isImportComplete && (
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        )}
      </div>

      {/* Progress Bar */}
      {!isImportComplete && (
        <div className="py-4">
          <StepProgressBar />
        </div>
      )}

      {/* Error Display */}
      {state.error && (
        <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          <p className="font-medium">Error</p>
          <p className="text-sm">{state.error}</p>
        </div>
      )}

      {/* Main Content Area */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-6 h-full overflow-y-auto">
          {/* Step Content */}
          {state.step === 'detect' && (
            <DetectStep userId={userId} />
          )}

          {state.step === 'map' && (
            <MapStep userId={userId} />
          )}

          {state.step === 'match' && (
            <MatchStep userId={userId} />
          )}

          {state.step === 'preview' && (
            <PreviewStep
              userId={userId}
              onStartImport={handleStartImport}
            />
          )}

          {state.step === 'import' && (
            <ImportStep
              userId={userId}
              onViewCalendar={onViewCalendar}
              onViewPrograms={onViewPrograms}
              onReset={handleReset}
              onStartImport={handleStartImport}
            />
          )}
        </CardContent>
      </Card>

      {/* Footer Navigation (hidden during import) */}
      {!isImportStep && (
        <div className="flex items-center justify-between py-4 px-1">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={!canGoBack() || state.loading}
            className={cn(!canGoBack() && 'opacity-0 pointer-events-none')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {/* Next button only shown for detect step after detection */}
          {state.step === 'detect' && state.detected.items.length > 0 && (
            <Button
              onClick={goNext}
              disabled={!canGoNext() || state.loading}
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Main BulkImport component with provider
 */
export function BulkImport(props: BulkImportProps) {
  return (
    <BulkImportProvider>
      <BulkImportContent {...props} />
    </BulkImportProvider>
  );
}

export default BulkImport;
