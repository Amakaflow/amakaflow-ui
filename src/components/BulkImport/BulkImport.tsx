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
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
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
          {onBack && !isImportRunning && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          <div>
            <h1 className="text-xl font-semibold">{stepInfo.title}</h1>
            <p className="text-sm text-muted-foreground">{stepInfo.description}</p>
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
