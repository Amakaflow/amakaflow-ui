import { Button } from './ui/button';
import { Sparkles } from 'lucide-react';

interface UpgradePromptProps {
  feature: string;
  message?: string;
  onUpgrade?: () => void;
}

export function UpgradePrompt({ feature, message, onUpgrade }: UpgradePromptProps) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center space-y-3">
      <Sparkles className="w-8 h-8 text-primary mx-auto" />
      <div>
        <p className="font-medium text-sm">{feature} is a Pro feature</p>
        <p className="text-xs text-muted-foreground mt-1">
          {message || 'Upgrade to Pro to unlock this feature and remove all limits.'}
        </p>
      </div>
      <Button size="sm" onClick={onUpgrade} className="gap-2">
        <Sparkles className="w-3.5 h-3.5" />
        Upgrade to Pro — $9.99/mo
      </Button>
    </div>
  );
}
