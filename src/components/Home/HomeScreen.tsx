import { Upload, Dumbbell, Calendar, History, TrendingUp, Flame, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { View } from '../../app/router';
import type { AppUser } from '../../app/useAppAuth';
import { isDemoMode } from '../../lib/demo-mode';
import { MOCK_ANALYTICS } from '../../lib/mock-data/analytics';
import { MOCK_WORKOUT_HISTORY } from '../../lib/mock-data/workouts';

interface HomeScreenProps {
  user: AppUser;
  recentWorkouts: any[];
  onNavigate: (view: View) => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatWorkoutDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

const QUICK_ACTIONS = [
  {
    label: 'Import Workout',
    description: 'From YouTube, image, or file',
    icon: <Upload className="w-5 h-5" />,
    view: 'import' as View,
    color: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  },
  {
    label: 'Generate Program',
    description: 'AI-powered training plan',
    icon: <Dumbbell className="w-5 h-5" />,
    view: 'programs' as View,
    color: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  },
  {
    label: 'Calendar',
    description: 'View scheduled workouts',
    icon: <Calendar className="w-5 h-5" />,
    view: 'calendar' as View,
    color: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  },
  {
    label: 'My Workouts',
    description: 'Browse your library',
    icon: <History className="w-5 h-5" />,
    view: 'workouts' as View,
    color: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  },
];

export function HomeScreen({ user, recentWorkouts, onNavigate }: HomeScreenProps) {
  const displayName = user.name?.split(' ')[0] || 'there';

  const stats = isDemoMode
    ? {
        totalWorkouts: MOCK_ANALYTICS.totalWorkouts,
        thisWeek: MOCK_ANALYTICS.workoutsThisWeek,
        streak: MOCK_ANALYTICS.currentStreak,
      }
    : {
        totalWorkouts: recentWorkouts.length,
        thisWeek: 0,
        streak: 0,
      };

  const workoutsToShow = isDemoMode && recentWorkouts.length === 0
    ? MOCK_WORKOUT_HISTORY.slice(0, 5)
    : recentWorkouts.slice(0, 5);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {getGreeting()}, {displayName}
        </h1>
        <p className="text-muted-foreground mt-1">Here's your training overview</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Dumbbell className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold">{stats.totalWorkouts}</p>
            <p className="text-sm text-muted-foreground">Total workouts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold">{stats.thisWeek}</p>
            <p className="text-sm text-muted-foreground">This week</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Flame className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold">{stats.streak}</p>
            <p className="text-sm text-muted-foreground">Day streak</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.view}
              onClick={() => onNavigate(action.view)}
              className="text-left rounded-xl border p-4 hover:bg-muted/50 transition-colors"
            >
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3 ${action.color}`}>
                {action.icon}
              </div>
              <p className="font-medium text-sm leading-tight">{action.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Recent workouts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent workouts</h2>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('workouts')}>
            View all
          </Button>
        </div>

        {workoutsToShow.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Dumbbell className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No workouts yet</p>
              <Button className="mt-4" onClick={() => onNavigate('import')}>
                Import your first workout
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y">
                {workoutsToShow.map((item: any, idx: number) => {
                  const workout = item.workout ?? item;
                  const title = workout.title || 'Untitled workout';
                  const date = item.completedAt || item.createdAt || item.date || '';
                  const type = workout.workout_type || workout.type || '';
                  return (
                    <li
                      key={item.id || idx}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Dumbbell className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{title}</p>
                        {date && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatWorkoutDate(date)}
                          </p>
                        )}
                      </div>
                      {type && (
                        <Badge variant="outline" className="text-xs capitalize flex-shrink-0">
                          {type}
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
