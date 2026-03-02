import { useState, useEffect } from 'react';
import { getWorkoutHistory, getWorkoutHistoryFromLocalStorage } from '../lib/workout-history';
import type { AppUser } from './useAppAuth';

export interface UseWorkoutHistory {
  workoutHistoryList: any[];
  setWorkoutHistoryList: React.Dispatch<React.SetStateAction<any[]>>;
  refreshHistory: () => Promise<void>;
}

export function useWorkoutHistory(user: AppUser | null): UseWorkoutHistory {
  const [workoutHistoryList, setWorkoutHistoryList] = useState<any[]>([]);

  const refreshHistory = async () => {
    if (!user?.id) return;
    try {
      const history = await getWorkoutHistory(user.id);
      setWorkoutHistoryList(history);
    } catch {
      try {
        setWorkoutHistoryList(getWorkoutHistoryFromLocalStorage());
      } catch {
        setWorkoutHistoryList([]);
      }
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refreshHistory();
  }, [user?.id]);

  return { workoutHistoryList, setWorkoutHistoryList, refreshHistory };
}
