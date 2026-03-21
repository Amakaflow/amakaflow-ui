/**
 * WorkoutImportDemo — standalone demo page for Playwright screenshots.
 *
 * AMA-1130: Renders the WorkoutImportModal in different states
 * for visual testing and screenshots.
 */

import { useState } from 'react';
import { WorkoutImportModal } from './WorkoutImportModal';
import { Button } from '../ui/button';

export function WorkoutImportDemo() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-8 max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold">AI Workout Import Demo</h1>
      <p className="text-muted-foreground">
        Click the button below to open the import modal in demo mode.
      </p>
      <Button onClick={() => setOpen(true)} data-testid="open-import-modal">
        Paste from AI
      </Button>

      <WorkoutImportModal
        open={open}
        onOpenChange={setOpen}
        demoMode={true}
        selectedDate={new Date()}
        onSave={(workout) => {
          console.log('Saved workout:', workout);
        }}
      />
    </div>
  );
}
