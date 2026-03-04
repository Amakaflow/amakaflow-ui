import { useState, useRef, useCallback } from 'react';
import { ServiceHealth } from './components/ServiceHealth';
import { RunHistory } from './components/RunHistory';
import { PipelineCanvas } from './components/PipelineCanvas';
import { StepDetail } from './components/StepDetail';
import { usePipelineRunner } from './hooks/usePipelineRunner';
import { useRunHistory } from './hooks/useRunHistory';
import type { PipelineRun, PipelineStep, FlowId, RunMode } from './store/runTypes';

export function PipelineObservatory() {
  const { run, isRunning, start, cancel } = usePipelineRunner();
  const { runs, refresh: refreshHistory } = useRunHistory();
  const [selectedStep, setSelectedStep] = useState<PipelineStep | null>(null);
  const [selectedHistoryRun, setSelectedHistoryRun] = useState<PipelineRun | null>(null);

  // Step-through mode: pausedStepId + resolve function
  const [pausedStepId, setPausedStepId] = useState<string | null>(null);
  const stepResolverRef = useRef<((output: unknown) => void) | null>(null);

  const handleStart = useCallback(async (
    flowId: FlowId,
    inputs: Record<string, unknown>,
    mode: RunMode,
  ) => {
    setSelectedStep(null);
    setSelectedHistoryRun(null);

    const onStepPaused = mode === 'step-through'
      ? async (stepId: string, _step: PipelineStep): Promise<unknown> => {
          setPausedStepId(stepId);
          return new Promise(resolve => {
            stepResolverRef.current = resolve;
          });
        }
      : undefined;

    await start(flowId, inputs, mode, onStepPaused);
    setPausedStepId(null);
    stepResolverRef.current = null;
    refreshHistory();
  }, [start, refreshHistory]);

  const handleStepContinue = useCallback((stepId: string, effectiveOutput: unknown) => {
    if (stepResolverRef.current && pausedStepId === stepId) {
      stepResolverRef.current(effectiveOutput);
      stepResolverRef.current = null;
      setPausedStepId(null);
    }
  }, [pausedStepId]);

  const handleCancel = useCallback(() => {
    cancel();
    setPausedStepId(null);
    // Resolve the paused step with its current output so the generator can terminate
    if (stepResolverRef.current) {
      stepResolverRef.current(undefined);
      stepResolverRef.current = null;
    }
  }, [cancel]);

  const handleSelectHistoryRun = useCallback((historyRun: PipelineRun) => {
    setSelectedHistoryRun(historyRun);
    setSelectedStep(null);
  }, []);

  const displayRun = selectedHistoryRun ?? run;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans">
      {/* Top bar */}
      <ServiceHealth />

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: Run History */}
        <div className="w-56 shrink-0">
          <RunHistory
            selectedRunId={selectedHistoryRun?.id ?? run?.id ?? null}
            onSelectRun={handleSelectHistoryRun}
            onNewRun={() => setSelectedHistoryRun(null)}
          />
        </div>

        {/* Center panel: Pipeline Canvas */}
        <div className="flex-1 overflow-hidden">
          <PipelineCanvas
            run={displayRun}
            isRunning={isRunning}
            selectedStepId={selectedStep?.id ?? null}
            onSelectStep={setSelectedStep}
            onStart={handleStart}
            onCancel={handleCancel}
            onStepContinue={handleStepContinue}
            pausedStepId={pausedStepId}
          />
        </div>

        {/* Right panel: Step Detail */}
        <div className="w-80 shrink-0 border-l overflow-hidden">
          <StepDetail step={selectedStep} />
        </div>
      </div>
    </div>
  );
}
