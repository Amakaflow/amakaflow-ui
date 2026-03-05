import { useState, useCallback, useRef } from 'react';
import { runPipeline } from '../runner/pipelineRunner';
import { saveRun, applyEventToRun } from '../store/runStore';
import type { PipelineRun, FlowDefinition, RunMode, PipelineStep } from '../store/runTypes';

export function usePipelineRunner() {
  const [run, setRun] = useState<PipelineRun | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const cancelledRef = useRef(false);
  const isRunningRef = useRef(false);

  const start = useCallback(async (
    flow: FlowDefinition,
    inputs: Record<string, unknown>,
    mode: RunMode,
    onStepPaused?: (stepId: string, step: PipelineStep) => Promise<unknown>,
  ) => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    cancelledRef.current = false;
    setIsRunning(true);

    const newRun: PipelineRun = {
      id: crypto.randomUUID(),
      flowId: flow.id,
      label: flow.label,
      mode,
      status: 'running',
      startedAt: Date.now(),
      inputs,
      steps: [],
    };
    setRun(newRun);
    await saveRun(newRun);

    const generator = runPipeline({ flow, inputs, mode, onStepPaused });

    let currentRun = newRun;
    for await (const event of generator) {
      if (cancelledRef.current) break;
      currentRun = applyEventToRun(currentRun, event);
      setRun({ ...currentRun });
      await saveRun(currentRun);
    }

    isRunningRef.current = false;
    setIsRunning(false);
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  return { run, isRunning, start, cancel };
}
