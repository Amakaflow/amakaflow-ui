import { cn } from '../../../components/ui/utils';
import { getStep } from '../registry/stepRegistry';
import { ParallelGroup } from './ParallelGroup';
import { isParallelGroup, type FlowStep } from '../store/runTypes';

interface FlowCanvasProps {
  steps: FlowStep[];
  activeStepId: string | null;
  onRemoveStep: (index: number) => void;
  onAddParallelGroup: () => void;
}

export function FlowCanvas({ steps, activeStepId, onRemoveStep, onAddParallelGroup }: FlowCanvasProps) {
  return (
    <div className="flex flex-col items-center gap-0 w-full max-w-xl mx-auto py-4 px-4">
      {steps.map((step, index) => (
        <div key={index} className="w-full flex flex-col items-center">
          {isParallelGroup(step) ? (
            <ParallelGroup
              group={step}
              activeStepId={activeStepId}
              onRemoveBranch={() => onRemoveStep(index)}
            />
          ) : (
            <SingleStep
              stepId={step}
              isActive={activeStepId === step}
              onRemove={() => onRemoveStep(index)}
            />
          )}
          {index < steps.length - 1 && (
            <div className="w-px h-4 bg-border my-0.5" />
          )}
        </div>
      ))}

      <div className="w-full mt-3 space-y-2">
        <button className="w-full border border-dashed border-border rounded-lg py-2 text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors">
          + Add step (from palette)
        </button>
        <button
          onClick={onAddParallelGroup}
          className="w-full border border-dashed border-border rounded-lg py-2 text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors"
        >
          + Add parallel group
        </button>
      </div>
    </div>
  );
}

function SingleStep({ stepId, isActive, onRemove }: { stepId: string; isActive: boolean; onRemove: () => void }) {
  const def = getStep(stepId);
  if (!def) return null;
  return (
    <div
      data-testid={`flow-step-${stepId}`}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-all',
        isActive
          ? 'border-blue-500 bg-blue-950/30 ring-2 ring-blue-500/20 shadow-lg scale-[1.01]'
          : 'border-border bg-card hover:border-muted-foreground/40',
      )}
    >
      <span className={cn('w-6 h-6 rounded-md flex items-center justify-center text-[11px] flex-shrink-0', def.colorClass)}>
        {def.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{def.label}</div>
        <div className="text-[10px] text-muted-foreground truncate">{def.service} · {def.mcpTool}</div>
      </div>
      <button
        aria-label={`remove ${stepId}`}
        onClick={onRemove}
        className="text-muted-foreground hover:text-foreground flex-shrink-0"
      >×</button>
    </div>
  );
}
