import { useState, useEffect, useCallback } from 'react';
import { getAllRuns } from '../store/runStore';
import type { PipelineRun } from '../store/runTypes';

export function useRunHistory() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const allRuns = await getAllRuns();
    setRuns(allRuns);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { runs, loading, refresh };
}
