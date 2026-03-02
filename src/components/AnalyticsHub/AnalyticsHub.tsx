import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { VolumeAnalytics } from '../VolumeAnalytics';
import { ExerciseHistory } from '../ExerciseHistory';
import { OverviewTab } from './OverviewTab';
import type { AppUser } from '../../app/useAppAuth';
import type { WorkoutHistoryItem } from '../../lib/workout-history';

interface AnalyticsHubProps {
  user: AppUser;
  history: WorkoutHistoryItem[];
}

export function AnalyticsHub({ user, history }: AnalyticsHubProps) {
  return (
    <div className="space-y-4" data-testid="analytics-hub">
      <div>
        <h2 className="text-2xl mb-2">Analytics</h2>
        <p className="text-muted-foreground">Your workout insights and progress</p>
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-3 max-w-xs">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="volume">Volume</TabsTrigger>
          <TabsTrigger value="exercise">Exercise</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6">
          <OverviewTab user={user} history={history} />
        </TabsContent>
        <TabsContent value="volume" className="mt-6">
          <VolumeAnalytics user={user} />
        </TabsContent>
        <TabsContent value="exercise" className="mt-6">
          <ExerciseHistory user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
