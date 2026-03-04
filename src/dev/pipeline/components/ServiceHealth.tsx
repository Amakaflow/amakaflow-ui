import { useServiceHealth } from '../hooks/useServiceHealth';
import { cn } from '../../../components/ui/utils';
import type { ServiceName } from '../store/runTypes';

const SERVICE_LABELS: Record<ServiceName, string> = {
  ingestor: 'Ingestor',
  mapper: 'Mapper',
  garmin: 'Garmin',
  strava: 'Strava',
  calendar: 'Calendar',
  chat: 'Chat',
};

export function ServiceHealth() {
  const { health, refresh } = useServiceHealth();

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b bg-background">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Services
      </span>
      <div className="flex items-center gap-3">
        {(Object.keys(SERVICE_LABELS) as ServiceName[]).map(name => {
          const status = health[name];
          return (
            <div key={name} className="flex items-center gap-1.5">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  status?.status === 'up' && 'bg-green-500',
                  status?.status === 'down' && 'bg-red-500',
                  status?.status === 'checking' && 'bg-yellow-500 animate-pulse',
                )}
                title={
                  status?.latencyMs !== undefined
                    ? `${status.latencyMs}ms`
                    : status?.status ?? 'unknown'
                }
              />
              <span className="text-xs text-muted-foreground">{SERVICE_LABELS[name]}</span>
              {status?.status === 'up' && status.latencyMs !== undefined && (
                <span className="text-xs text-muted-foreground/60">{status.latencyMs}ms</span>
              )}
            </div>
          );
        })}
      </div>
      <button
        onClick={refresh}
        className="ml-auto text-xs text-muted-foreground hover:text-foreground"
      >
        Refresh
      </button>
    </div>
  );
}
