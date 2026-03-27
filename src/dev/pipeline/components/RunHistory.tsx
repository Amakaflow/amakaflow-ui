import { useRunHistory } from '../hooks/useRunHistory';
import { cn } from '../../../components/ui/utils';
import type { PipelineRun } from '../store/runTypes';

interface RunHistoryProps {
  selectedRunId: string | null;
  onSelectRun: (run: PipelineRun) => void;
  onNewRun: () => void;
}

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

export function RunHistory({ selectedRunId, onSelectRun, onNewRun }: RunHistoryProps) {
  const { runs, loading } = useRunHistory();

  return (
    <div className="flex flex-col h-full border-r">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-semibold">Run History</span>
        <button
          onClick={onNewRun}
          className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
        >
          + New Run
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-3 text-xs text-muted-foreground">Loading…</div>
        )}
        {!loading && runs.length === 0 && (
          <div className="p-3 text-xs text-muted-foreground">No runs yet. Start a new run.</div>
        )}
        {runs.map(run => (
          <button
            key={run.id}
            onClick={() => onSelectRun(run)}
            className={cn(
              'w-full text-left px-3 py-2 border-b hover:bg-muted/50 transition-colors',
              selectedRunId === run.id && 'bg-muted',
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium truncate">{run.label || run.flowId}</span>
              <span
                className={cn(
                  'text-xs ml-2 shrink-0',
                  run.status === 'success' && 'text-green-600',
                  run.status === 'failed' && 'text-red-600',
                  run.status === 'running' && 'text-yellow-600',
                  run.status === 'cancelled' && 'text-muted-foreground',
                )}
              >
                {run.status === 'success' ? '✓' : run.status === 'failed' ? '✗' : run.status === 'running' ? '●' : '○'}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {formatRelativeTime(run.startedAt)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
