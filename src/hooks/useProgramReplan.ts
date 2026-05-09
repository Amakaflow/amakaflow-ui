/**
 * useProgramReplan — hook for partial program re-plan logic (AMA-1456).
 *
 * Encapsulates week-range derivation, state management, and SSE streaming
 * so ProgramActions only handles rendering.
 */

import { useState, useCallback, useRef } from 'react';
import type { TrainingProgram } from '@/types/training-program';
import { REPLAN_PRESETS, streamReplan } from '@/lib/program-replan-api';

interface UseProgramReplanOptions {
  program: TrainingProgram;
  onReplanComplete?: (previewId: string) => void;
}

interface UseProgramReplanReturn {
  isReplanning: boolean;
  replanError: string | null;
  triggerReplan: (presetIndex: number) => Promise<void>;
  cancelReplan: () => void;
}

export function useProgramReplan({
  program,
  onReplanComplete,
}: UseProgramReplanOptions): UseProgramReplanReturn {
  const [isReplanning, setIsReplanning] = useState(false);
  const [replanError, setReplanError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const cancelReplan = useCallback(() => {
    controllerRef.current?.abort();
    setIsReplanning(false);
  }, []);

  const triggerReplan = useCallback(
    async (presetIndex: number) => {
      const preset = REPLAN_PRESETS[presetIndex];
      if (!preset) return;

      const totalWeeks = program.weeks?.length ?? program.duration_weeks;

      if (!totalWeeks || totalWeeks < 1) {
        setReplanError('Program has no valid weeks to re-plan.');
        return;
      }

      const currentWeek = Math.max(1, program.current_week ?? 1);

      let startWeek: number;
      let endWeek: number | undefined;

      if (preset.startWeekOffset !== null) {
        startWeek = Math.min(totalWeeks, currentWeek + preset.startWeekOffset);
      } else {
        // "last N weeks" — count back from end
        startWeek = Math.max(1, totalWeeks - (preset.weeksCount ?? 4) + 1);
      }

      if (preset.weeksCount !== null) {
        const candidate = startWeek + preset.weeksCount - 1;
        endWeek = Math.min(totalWeeks, candidate);
      }

      if (endWeek !== undefined && startWeek > endWeek) {
        setReplanError('Invalid re-plan week range.');
        return;
      }

      // Re-plan requires a preview_id. For saved programs, program.id is sent
      // as a best-effort key; the backend returns a clear "not found" error if
      // no matching preview exists, which surfaces via onError below.
      const previewId = program.id;

      setIsReplanning(true);
      setReplanError(null);

      const controller = await streamReplan(
        { preview_id: previewId, start_week: startWeek, end_week: endWeek },
        {
          onPreview: (ev) => {
            setIsReplanning(false);
            onReplanComplete?.(ev.preview_id);
          },
          onError: (ev) => {
            setIsReplanning(false);
            setReplanError(ev.message);
          },
          onDone: () => setIsReplanning(false),
        },
      );

      controllerRef.current = controller;
    },
    [program, onReplanComplete],
  );

  return { isReplanning, replanError, triggerReplan, cancelReplan };
}
