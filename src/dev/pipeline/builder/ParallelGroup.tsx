import { cn } from '../../../components/ui/utils';
import { getStep } from '../registry/stepRegistry';
import type { ParallelGroup as ParallelGroupType } from '../store/runTypes';

interface ParallelGroupProps {
  group: ParallelGroupType;
  activeStepId: string | null;
  onRemoveGroup: () => void;
}

export function ParallelGroup({ group, activeStepId, onRemoveGroup }: ParallelGroupProps) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider text-center mb-1.5">
        <div className="flex-1 h-px bg-border" />
        Parallel export
        <div className="flex-1 h-px bg-border" />
      </div>
      <div className="flex gap-2">
        {group.steps.map(stepId => {
          const def = getStep(stepId);
          if (!def) return null;
          const isActive = activeStepId === stepId;
          return (
            <div
              key={stepId}
              data-testid={`flow-step-${stepId}`}
              className={cn(
                'flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm',
                isActive
                  ? 'border-blue-500 bg-blue-950/40 ring-2 ring-blue-500/30 shadow-lg'
                  : 'border-border bg-card',
              )}
            >
              <span className={cn('w-5 h-5 rounded flex items-center justify-center text-[10px] flex-shrink-0', def.colorClass)}>
                {def.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="truncate text-xs font-medium">{def.label}</div>
                <div className="truncate text-[10px] text-muted-foreground">{def.mcpTool}</div>
              </div>
              <button
                aria-label={`remove ${stepId}`}
                onClick={onRemoveGroup}
                className="text-muted-foreground hover:text-foreground text-sm flex-shrink-0"
              >×</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
