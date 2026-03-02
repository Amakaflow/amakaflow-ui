import type { AppUser } from '../../app/useAppAuth';
import type { WorkoutHistoryItem } from '../../lib/workout-history';

interface OverviewTabProps {
  user: AppUser;
  history: WorkoutHistoryItem[];
}

export function OverviewTab({ history }: OverviewTabProps) {
  return <div data-testid="overview-tab">Overview ({history.length} workouts)</div>;
}
