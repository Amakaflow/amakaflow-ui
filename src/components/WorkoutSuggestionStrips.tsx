import { Lightbulb } from 'lucide-react';
import { Button } from './ui/button';

function SuggestionStrip({
  message,
  actionLabel,
  onAction,
  onSkip,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-dashed bg-muted/20 text-sm">
      <Lightbulb className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground flex-1">{message}</span>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onAction} aria-label={actionLabel}>
        + {actionLabel}
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={onSkip} aria-label="skip">
        Skip
      </Button>
    </div>
  );
}

export function WarmupSuggestionStrip({
  onAdd,
  onSkip,
}: {
  onAdd: () => void;
  onSkip: () => void;
}) {
  return (
    <SuggestionStrip
      message="No warm-up found. Want to add one?"
      actionLabel="Add Warm-up"
      onAction={onAdd}
      onSkip={onSkip}
    />
  );
}

export function CooldownSuggestionStrip({
  onAdd,
  onSkip,
}: {
  onAdd: () => void;
  onSkip: () => void;
}) {
  return (
    <SuggestionStrip
      message="No cooldown found. Want to add one?"
      actionLabel="Add Cooldown"
      onAction={onAdd}
      onSkip={onSkip}
    />
  );
}

export function DefaultRestStrip({
  onSet,
  onSkip,
}: {
  onSet: () => void;
  onSkip: () => void;
}) {
  return (
    <SuggestionStrip
      message="No default rest set. Add a rest period that applies to all blocks?"
      actionLabel="Set Rest"
      onAction={onSet}
      onSkip={onSkip}
    />
  );
}
