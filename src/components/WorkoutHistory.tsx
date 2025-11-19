import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Clock, Dumbbell, Watch, Bike, Download, Activity, CheckCircle2, ExternalLink } from 'lucide-react';
import { WorkoutHistoryItem } from '../lib/workout-history';
import { isAccountConnectedSync } from '../lib/linked-accounts';

type Props = {
  history: WorkoutHistoryItem[];
  onLoadWorkout: (item: WorkoutHistoryItem) => void;
  onDeleteWorkout: (id: string) => void;
  onEnhanceStrava?: (item: WorkoutHistoryItem) => void;
};

export function WorkoutHistory({ history, onLoadWorkout, onDeleteWorkout, onEnhanceStrava }: Props) {
  const stravaConnected = isAccountConnectedSync('strava');
  
  // Ensure history is an array
  const safeHistory = Array.isArray(history) ? history : [];
  
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown date';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case 'garmin':
      case 'apple':
        return <Watch className="w-4 h-4" />;
      case 'zwift':
        return <Bike className="w-4 h-4" />;
      default:
        return <Dumbbell className="w-4 h-4" />;
    }
  };

  if (safeHistory.length === 0) {
    return (
      <div className="text-center py-16">
        <Dumbbell className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
        <h3 className="text-xl mb-2">No workout history yet</h3>
        <p className="text-muted-foreground mb-6">
          Create your first workout to see it here
        </p>
        <Button onClick={() => window.location.reload()}>
          Create Workout
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl mb-2">Workout History</h2>
        <p className="text-muted-foreground">
          {safeHistory.length} workout{safeHistory.length !== 1 ? 's' : ''} saved
        </p>
      </div>

      <ScrollArea className="h-[calc(100vh-250px)]">
        <div className="grid gap-4 pr-4">
          {safeHistory.map((item) => {
            const exerciseCount = (item.workout.blocks || []).reduce(
              (sum, block) => {
                // Handle both old format (exercises directly on block) and new format (exercises in supersets)
                if (block?.supersets && block.supersets.length > 0) {
                  return sum + block.supersets.reduce((s, ss) => s + (ss?.exercises?.length || 0), 0);
                } else if (block?.exercises) {
                  return sum + (block.exercises.length || 0);
                }
                return sum;
              },
              0
            );

            return (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{item.workout.title || 'Untitled Workout'}</CardTitle>
                      <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDate(item.createdAt)}
                        </div>
                        <div className="flex items-center gap-1">
                          {getDeviceIcon(item.device)}
                          {item.device.charAt(0).toUpperCase() + item.device.slice(1)}
                        </div>
                        {item.syncedToStrava && (
                          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-4 h-4" />
                            Synced to Strava
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={item.exports ? 'default' : 'secondary'}>
                        {item.exports ? 'Exported' : 'Draft'}
                      </Badge>
                      {item.syncedToStrava && item.stravaActivityId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs gap-1 -mt-1"
                          onClick={() => window.open(`https://www.strava.com/activities/${item.stravaActivityId}`, '_blank')}
                        >
                          <ExternalLink className="w-3 h-3" />
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{item.workout.blocks?.length || 0} blocks</span>
                      <span>{exerciseCount} exercises</span>
                      {item.sources && item.sources.length > 0 && (
                        <span>{item.sources.length} sources</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onLoadWorkout(item)}
                      >
                        Load
                      </Button>
                      {item.exports && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // Download logic
                            const format = item.device === 'garmin' ? item.exports?.fit 
                              : item.device === 'apple' ? item.exports?.plist 
                              : item.exports?.zwo;
                            
                            if (format) {
                              const blob = new Blob([format], { type: 'text/plain' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${(item.workout.title || 'workout').replace(/\s+/g, '_')}.${
                                item.device === 'garmin' ? 'fit' : item.device === 'apple' ? 'plist' : 'zwo'
                              }`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }
                          }}
                          className="gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Export
                        </Button>
                      )}
                      {onEnhanceStrava && !item.syncedToStrava && stravaConnected && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onEnhanceStrava(item)}
                          className="gap-2"
                        >
                          <Activity className="w-4 h-4" />
                          Enhance on Strava
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}