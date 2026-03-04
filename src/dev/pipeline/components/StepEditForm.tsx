import { useState, useRef } from 'react';
import { cn } from '../../../components/ui/utils';
import type { PipelineStep } from '../store/runTypes';

interface StepEditFormProps {
  step: PipelineStep;
  onContinue: (effectiveOutput: unknown) => void;
  onAbort: () => void;
}

export function StepEditForm({ step, onContinue, onAbort }: StepEditFormProps) {
  const [json, setJson] = useState(
    () => JSON.stringify(step.apiOutput ?? step.response?.body, null, 2) ?? ''
  );
  const [parseError, setParseError] = useState<string | null>(null);

  const initialJsonRef = useRef(
    JSON.stringify(step.apiOutput ?? step.response?.body, null, 2) ?? ''
  );
  const isDirty = json !== initialJsonRef.current;

  function handleContinue() {
    try {
      const parsed = JSON.parse(json);
      setParseError(null);
      onContinue(parsed);
    } catch (e) {
      setParseError((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 border rounded-md bg-background">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Edit step output</div>
          <div className="text-xs text-muted-foreground">{step.label} · {step.service}</div>
        </div>
        {isDirty && (
          <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
            modified
          </span>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Output sent to next step (edit to override)
        </label>
        <textarea
          value={json}
          onChange={e => {
            setJson(e.target.value);
            setParseError(null);
          }}
          className={cn(
            'w-full font-mono text-xs rounded border bg-muted/30 p-2 resize-y min-h-48 focus:outline-none focus:ring-1 focus:ring-primary',
            parseError && 'border-red-400',
          )}
          spellCheck={false}
        />
        {parseError && (
          <div className="text-xs text-red-600 dark:text-red-400">{parseError}</div>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onAbort}
          className="px-3 py-1.5 text-sm rounded border hover:bg-muted transition-colors"
        >
          Abort
        </button>
        <button
          onClick={handleContinue}
          className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
