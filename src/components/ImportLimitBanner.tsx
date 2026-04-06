import { getImportsRemaining, getUserTier } from '../lib/subscription';
import { Badge } from './ui/badge';

export function ImportLimitBanner() {
  const tier = getUserTier();
  if (tier === 'pro') return null;

  const remaining = getImportsRemaining();

  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/50 border px-4 py-2 text-sm">
      <span className="text-muted-foreground">
        {remaining > 0
          ? `${remaining} free import${remaining !== 1 ? 's' : ''} remaining this month`
          : 'Monthly import limit reached'
        }
      </span>
      <Badge variant={remaining > 0 ? 'secondary' : 'destructive'} className="text-xs">
        {remaining > 0 ? `${remaining}/5` : 'Limit reached'}
      </Badge>
    </div>
  );
}
