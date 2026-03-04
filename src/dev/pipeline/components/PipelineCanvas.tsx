import { useState } from 'react';
import { cn } from '../../../components/ui/utils';
import { StepCard } from './StepCard';
import { StepEditForm } from './StepEditForm';
import type { PipelineRun, PipelineStep, FlowId, RunMode } from '../store/runTypes';

type ViewMode = 'steps' | 'raw';

const FLOW_OPTIONS: { id: FlowId; label: string }[] = [
  { id: 'full-pipeline', label: 'Full Pipeline' },
  { id: 'ingest-only', label: 'Ingest Only' },
  { id: 'map-only', label: 'Map Only' },
  { id: 'health-check', label: 'Health Check' },
];

const FLOW_IDS = FLOW_OPTIONS.map(f => f.id);
const RUN_MODES: RunMode[] = ['auto', 'step-through'];

function isFlowId(v: string): v is FlowId {
  return (FLOW_IDS as string[]).includes(v);
}
function isRunMode(v: string): v is RunMode {
  return (RUN_MODES as string[]).includes(v);
}

interface PipelineCanvasProps {
  run: PipelineRun | null;
  isRunning: boolean;
  selectedStepId: string | null;
  onSelectStep: (step: PipelineStep) => void;
  onStart: (flowId: FlowId, inputs: Record<string, unknown>, mode: RunMode) => void;
  onCancel: () => void;
  // Step-through mode: called when the user clicks Continue on the edit form
  onStepContinue?: (stepId: string, effectiveOutput: unknown) => void;
  pausedStepId?: string | null;
}

export function PipelineCanvas({
  run,
  isRunning,
  selectedStepId,
  onSelectStep,
  onStart,
  onCancel,
  onStepContinue,
  pausedStepId,
}: PipelineCanvasProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('steps');
  const [flowId, setFlowId] = useState<FlowId>('full-pipeline');
  const [runMode, setRunMode] = useState<RunMode>('auto');
  const [workoutText, setWorkoutText] = useState('bench press 3x10, squat 3x5, overhead press 3x8');

  function handleStart() {
    const inputs: Record<string, unknown> = flowId === 'map-only'
      ? { exercises: workoutText.split(',').map(s => s.trim()).filter(Boolean) }
      : { workoutText };
    onStart(flowId, inputs, runMode);
  }

  const pausedStep = run?.steps.find(s => s.id === pausedStepId) ?? null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Controls */}
      <div className="flex items-center gap-3 px-4 py-2 border-b flex-wrap">
        <select
          value={flowId}
          onChange={e => { if (isFlowId(e.target.value)) setFlowId(e.target.value); }}
          disabled={isRunning}
          className="text-sm border rounded px-2 py-1 bg-background"
        >
          {FLOW_OPTIONS.map(f => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>

        <select
          value={runMode}
          onChange={e => { if (isRunMode(e.target.value)) setRunMode(e.target.value); }}
          disabled={isRunning}
          className="text-sm border rounded px-2 py-1 bg-background"
        >
          <option value="auto">Auto</option>
          <option value="step-through">Step-through</option>
        </select>

        {!isRunning ? (
          <button
            onClick={handleStart}
            className="px-3 py-1 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90"
          >
            ▶ Run
          </button>
        ) : (
          <button
            onClick={onCancel}
            className="px-3 py-1 text-sm rounded bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            ⏹ Stop
          </button>
        )}

        <div className="ml-auto flex gap-1">
          {(['steps', 'raw'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'px-2 py-1 text-xs rounded capitalize',
                viewMode === mode
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground',
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      {!isRunning && (
        <div className="px-4 py-2 border-b">
          <textarea
            value={workoutText}
            onChange={e => setWorkoutText(e.target.value)}
            placeholder={flowId === 'map-only' ? 'bench press, squat, overhead press' : 'bench press 3x10, squat 3x5...'}
            className="w-full text-sm border rounded px-2 py-1.5 bg-background resize-none h-16 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      {/* Step-through edit form */}
      {pausedStep && onStepContinue && (
        <div className="px-4 py-3 border-b bg-muted/30">
          <StepEditForm
            key={pausedStep.id}
            step={pausedStep}
            onContinue={(output) => onStepContinue(pausedStep.id, output)}
            onAbort={onCancel}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {!run && (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Configure a flow above and click Run.
          </div>
        )}

        {run && viewMode === 'steps' && (
          <div className="flex flex-col gap-2">
            {run.steps.length === 0 && isRunning && (
              <div className="text-sm text-muted-foreground">Starting…</div>
            )}
            {run.steps.map(step => (
              <StepCard
                key={step.id}
                step={step}
                isSelected={selectedStepId === step.id}
                onClick={() => onSelectStep(step)}
              />
            ))}
          </div>
        )}

        {run && viewMode === 'raw' && (
          <pre className="text-xs font-mono bg-muted/50 rounded p-3 overflow-auto whitespace-pre-wrap break-words">
            {JSON.stringify(run, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
