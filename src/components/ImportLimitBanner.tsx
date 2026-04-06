// TODO: Extract to useSubscription hook when usage tracking moves to Supabase
import { getImportsRemaining, getUserTier, getTierLimits } from '../lib/subscription';
import { Badge } from './ui/badge';

export function ImportLimitBanner() {
  const tier = getUserTier();
  if (tier === 'pro') return null;

  const remaining = getImportsRemaining();
  const limits = getTierLimits();

  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/50 border px-4 py-2 text-sm">
      <span className="text-muted-foreground">
        {remaining > 0
          ? `${remaining} free import${remaining !== 1 ? 's' : ''} remaining this month`
          : 'Monthly import limit reached'
        }
      </span>
      <Badge variant={remaining > 0 ? 'secondary' : 'destructive'} className="text-xs">
        {remaining > 0 ? `${remaining}/${limits.importsPerMonth}` : 'Limit reached'}
      </Badge>
    </div>
  );
}
