import { useState } from 'react';
import { cn } from '../../../components/ui/utils';
import { StepCard } from './StepCard';
import { StepEditForm } from './StepEditForm';
import { StepPalette } from '../builder/StepPalette';
import { FlowCanvas } from '../builder/FlowCanvas';
import { PRESETS, getPreset } from '../registry/presets';
import { getStep } from '../registry/stepRegistry';
import { getUserPresets, saveUserPreset } from '../registry/userPresets';
import { isParallelGroup, type FlowDefinition, type FlowStep, type PipelineRun, type PipelineStep, type RunMode } from '../store/runTypes';


type ViewMode = 'steps' | 'raw';
type InputType = 'text' | 'youtube' | 'instagram' | 'tiktok' | 'url';

const INPUT_TYPE_OPTIONS: { id: InputType; label: string }[] = [
  { id: 'text', label: 'Text' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'url', label: 'URL' },
];

const RUN_MODES: RunMode[] = ['auto', 'step-through'];

function isRunMode(v: string): v is RunMode {
  return (RUN_MODES as string[]).includes(v);
}
function isInputType(v: string): v is InputType {
  return (INPUT_TYPE_OPTIONS.map(o => o.id) as string[]).includes(v);
}

function isValidUrl(s: string): boolean {
  try { new URL(s); return true; } catch { return false; }
}


interface PipelineCanvasProps {
  run: PipelineRun | null;
  isRunning: boolean;
  selectedStepId: string | null;
  onSelectStep: (step: PipelineStep) => void;
  onStart: (flow: FlowDefinition, inputs: Record<string, unknown>, mode: RunMode) => void;
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
  const [runMode, setRunMode] = useState<RunMode>('auto');
  const [inputType, setInputType] = useState<InputType>('text');
  const [workoutText, setWorkoutText] = useState('bench press 3x10, squat 3x5, overhead press 3x8');
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [currentFlow, setCurrentFlow] = useState<FlowDefinition>(PRESETS[0]);
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [userPresets, setUserPresets] = useState<FlowDefinition[]>(() => {
    try { return getUserPresets(); } catch { return []; }
  });

  function handlePresetChange(id: string) {
    const preset = getPreset(id) ?? userPresets.find(p => p.id === id);
    if (preset) { setCurrentFlow(preset); setPresetId(id); }
  }

  function handleSavePreset() {
    const name = window.prompt('Preset name?');
    if (!name) return;
    const preset: FlowDefinition = {
      id: `user-${Date.now()}`,
      label: name,
      steps: currentFlow.steps,
    };
    saveUserPreset(preset);
    setUserPresets(getUserPresets());
    setPresetId(preset.id);
  }

  function handleAddStep(stepId: string) {
    setCurrentFlow(f => ({ ...f, steps: [...f.steps, stepId] }));
  }

  function handleRemoveStep(index: number) {
    setCurrentFlow(f => {
      const steps = [...f.steps];
      steps.splice(index, 1);
      return { ...f, steps };
    });
  }

  function handleAddParallelGroup() {
    setCurrentFlow(f => ({
      ...f,
      steps: [...f.steps, { type: 'parallel' as const, steps: [] }],
    }));
  }

  function handleStart() {
    if (inputType !== 'text') {
      if (!urlInput.trim()) { setUrlError('URL is required'); return; }
      if (!isValidUrl(urlInput)) { setUrlError('Please enter a valid URL'); return; }
      setUrlError(null);
    } else {
      setUrlError(null);
    }
    const inputs: Record<string, unknown> = inputType === 'text'
      ? { workoutText, inputType }
      : { url: urlInput, inputType };
    onStart(currentFlow, inputs, runMode);
  }

  const isUrlType = inputType !== 'text';
  const pausedStep = run?.steps.find(s => s.id === pausedStepId) ?? null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Controls */}
      <div className="flex items-center gap-3 px-4 py-2 border-b flex-wrap">
        <select
          value={presetId}
          onChange={e => handlePresetChange(e.target.value)}
          disabled={isRunning}
          className="text-sm border rounded px-2 py-1 bg-background"
        >
          <optgroup label="Built-in">
            {PRESETS.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </optgroup>
          {userPresets.length > 0 && (
            <optgroup label="Saved">
              {userPresets.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
          )}
        </select>

        <button
          onClick={handleSavePreset}
          disabled={isRunning}
          title="Save current canvas as a new preset"
          className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors"
        >
          Save preset
        </button>

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

        {isRunning && (() => {
          const activeStep = run?.steps.findLast?.(s => s.status === 'running');
          return activeStep ? (
            <div
              data-testid="active-step-indicator"
              className="flex items-center gap-1.5 bg-blue-950/60 border border-blue-800 rounded px-2 py-1 text-xs text-blue-300"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              {activeStep.label}
            </div>
          ) : null;
        })()}

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
          {/* Input Type Selector */}
          <div className="flex items-center gap-2 mb-2">
            <select
              value={inputType}
              onChange={e => { if (isInputType(e.target.value)) setInputType(e.target.value); }}
              disabled={isRunning}
              className="text-sm border rounded px-2 py-1 bg-background"
            >
              {INPUT_TYPE_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>

            {isUrlType ? (
              <input
                type="text"
                value={urlInput}
                onChange={e => { setUrlInput(e.target.value); setUrlError(null); }}
                placeholder="https://youtube.com/watch?v=..."
                className={cn(
                  'flex-1 text-sm border rounded px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary',
                  urlError && 'border-destructive focus:ring-destructive'
                )}
              />
            ) : (
              <textarea
                value={workoutText}
                onChange={e => setWorkoutText(e.target.value)}
                placeholder="bench press 3x10, squat 3x5..."
                className="w-full text-sm border rounded px-2 py-1.5 bg-background resize-none h-16 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            )}
          </div>

          {/* URL Error Message */}
          {urlError && (
            <div className="text-sm text-destructive mt-1">
              {urlError}
            </div>
          )}
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
      <div className="flex-1 overflow-hidden flex flex-col">
        {!run && !isRunning && (
          <div className="flex flex-1 overflow-hidden">
            <StepPalette
              collapsed={paletteCollapsed}
              onToggleCollapse={() => setPaletteCollapsed(c => !c)}
              onAddStep={handleAddStep}
            />
            <div className="flex-1 overflow-y-auto">
              <FlowCanvas
                steps={currentFlow.steps}
                activeStepId={null}
                onRemoveStep={handleRemoveStep}
                onAddParallelGroup={handleAddParallelGroup}
              />
            </div>
          </div>
        )}

        {(run || isRunning) && viewMode === 'steps' && (
          <div className="flex flex-1 overflow-hidden">
            <StepPalette collapsed={true} onToggleCollapse={() => setPaletteCollapsed(c => !c)} onAddStep={() => {}} />
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-col gap-2">
                {run?.steps.length === 0 && isRunning && (
                  <div className="text-sm text-muted-foreground">Starting…</div>
                )}
                {run?.steps.map(step => (
                  <StepCard
                    key={step.id}
                    step={step}
                    isSelected={selectedStepId === step.id}
                    onClick={() => onSelectStep(step)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {(run || isRunning) && viewMode === 'raw' && (
          <pre className="flex-1 overflow-auto text-xs font-mono bg-muted/50 rounded p-3 whitespace-pre-wrap break-words m-4">
            {JSON.stringify(run, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

