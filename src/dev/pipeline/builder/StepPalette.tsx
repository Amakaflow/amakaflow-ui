import { cn } from '../../../components/ui/utils';
import { STEP_GROUPS, GROUP_LABELS, getStepsByGroup } from '../registry/stepRegistry';

interface StepPaletteProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onAddStep: (stepId: string) => void;
}

export function StepPalette({ collapsed, onToggleCollapse, onAddStep }: StepPaletteProps) {
  return (
    <div
      className={cn(
        'flex flex-col border-r bg-background transition-all duration-200 overflow-hidden flex-shrink-0',
        collapsed ? 'w-11' : 'w-52',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-2.5 min-h-[36px]">
        {!collapsed && (
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            Step Palette
          </span>
        )}
        <button
          aria-label={collapsed ? 'expand palette' : 'collapse palette'}
          onClick={onToggleCollapse}
          className="text-muted-foreground hover:text-foreground text-sm px-1 ml-auto"
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {collapsed ? (
        /* Icon rail */
        <div className="flex flex-col items-center gap-1.5 px-1 pt-1">
          {STEP_GROUPS.flatMap(group =>
            getStepsByGroup(group).map(step => (
              <button
                key={step.id}
                title={step.label}
                onClick={() => onAddStep(step.id)}
                className={cn(
                  'w-7 h-7 rounded-md flex items-center justify-center text-xs cursor-pointer',
                  step.colorClass,
                )}
              >
                {step.icon}
              </button>
            ))
          )}
        </div>
      ) : (
        /* Full palette */
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {STEP_GROUPS.map(group => {
            const steps = getStepsByGroup(group);
            if (steps.length === 0) return null;
            return (
              <div key={group} className="mb-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider px-1.5 pb-1.5 pt-1">
                  {GROUP_LABELS[group]}
                </div>
                {steps.map(step => (
                  <button
                    key={step.id}
                    onClick={() => onAddStep(step.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-left mb-0.5"
                  >
                    <span className={cn('w-5 h-5 rounded flex items-center justify-center text-[10px] flex-shrink-0', step.colorClass)}>
                      {step.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-foreground truncate">{step.label}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{step.mcpTool}</div>
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
