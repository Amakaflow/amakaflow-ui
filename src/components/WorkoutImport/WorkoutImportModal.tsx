/**
 * WorkoutImportModal — "Paste from AI" modal for importing workouts.
 *
 * AMA-1130: Large textarea for pasting AI-generated workout text,
 * parses via the backend, and shows a structured preview.
 *
 * Flow: Empty modal -> Paste text -> Parse -> Preview -> Save
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Loader2, Sparkles, AlertCircle, ClipboardPaste } from 'lucide-react';
import { useWorkoutParser } from './hooks/useWorkoutParser';
import { WorkoutPreview } from './WorkoutPreview';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WorkoutImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, uses mock data instead of hitting the API */
  demoMode?: boolean;
  /** Called when user clicks "Save to Calendar" with the parsed workout */
  onSave?: (workout: Record<string, unknown>) => void;
  /** Selected date for the calendar (shown in header) */
  selectedDate?: Date;
}

// ---------------------------------------------------------------------------
// Example prompts (shown as placeholder hints)
// ---------------------------------------------------------------------------

const PLACEHOLDER = `Paste your AI-generated workout here...

Examples:
  "5x1km at threshold, 2min jog recovery"
  "4x8 bench press, 3x10 rows, 3x12 curls"
  "EMOM 20: odd mins 15 KB swings, even mins 10 burpees"
  "8 rounds: 500m row, 50m farmers carry, 20 wall balls"`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkoutImportModal({
  open,
  onOpenChange,
  demoMode = false,
  onSave,
  selectedDate,
}: WorkoutImportModalProps) {
  const [text, setText] = useState('');
  const { state, result, error, parseWorkout, reset, updateExercise, updateTitle } =
    useWorkoutParser(demoMode);

  const handleParse = () => {
    if (text.trim().length < 10) return;
    parseWorkout(text.trim());
  };

  const handleReset = () => {
    reset();
    setText('');
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      handleReset();
    }
    onOpenChange(nextOpen);
  };

  const handleSave = () => {
    if (result && onSave) {
      onSave(result as unknown as Record<string, unknown>);
    }
    handleClose(false);
  };

  const handlePaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) setText(clipText);
    } catch {
      // Clipboard API may not be available
    }
  };

  const dateLabel = selectedDate
    ? selectedDate.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="workout-import-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Paste from AI
            {dateLabel && (
              <Badge variant="outline" className="ml-2 font-normal">
                {dateLabel}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Paste workout text from ChatGPT, Gemini, or any AI assistant and we will
            parse it into a structured workout.
          </DialogDescription>
        </DialogHeader>

        {/* Demo mode indicator */}
        {demoMode && (
          <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs text-blue-700 dark:text-blue-400">
            Demo mode — using pre-parsed example data
          </div>
        )}

        {/* IDLE / INPUT STATE */}
        {(state === 'idle' || state === 'error') && (
          <div className="space-y-3">
            <div className="relative">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={PLACEHOLDER}
                className="min-h-[200px] font-mono text-sm"
                data-testid="workout-text-input"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 text-xs"
                onClick={handlePaste}
              >
                <ClipboardPaste className="h-3.5 w-3.5 mr-1" />
                Paste
              </Button>
            </div>

            {/* Error message */}
            {state === 'error' && error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Character count + parse button */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {text.length} / 10,000 characters
                {text.length > 0 && text.length < 10 && (
                  <span className="text-yellow-600 ml-2">Need at least 10 characters</span>
                )}
              </span>
              <Button
                onClick={handleParse}
                disabled={text.trim().length < 10}
                data-testid="parse-button"
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                Parse Workout
              </Button>
            </div>
          </div>
        )}

        {/* LOADING STATE */}
        {state === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4" data-testid="loading-state">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">Parsing workout...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Extracting exercises, sets, reps, and targets
              </p>
            </div>
          </div>
        )}

        {/* SUCCESS / PREVIEW STATE */}
        {state === 'success' && result && (
          <WorkoutPreview
            workout={result}
            onSave={handleSave}
            onReset={handleReset}
            onEditExercise={updateExercise}
            onEditTitle={updateTitle}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
