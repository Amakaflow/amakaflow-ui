import { useSubscription } from '../hooks/useSubscription';
import { Badge } from './ui/badge';

export function ImportLimitBanner() {
  const { tier, isPro, importsRemaining, limits } = useSubscription();
  if (isPro) return null;

  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/50 border px-4 py-2 text-sm">
      <span className="text-muted-foreground">
        {importsRemaining > 0
          ? `${importsRemaining} free import${importsRemaining !== 1 ? 's' : ''} remaining this month`
          : 'Monthly import limit reached'
        }
      </span>
      <Badge variant={importsRemaining > 0 ? 'secondary' : 'destructive'} className="text-xs">
        {importsRemaining > 0 ? `${importsRemaining}/${limits.importsPerMonth}` : 'Limit reached'}
      </Badge>
    </div>
  );
}
