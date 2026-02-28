import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { TrendingUp, Dumbbell, Clock, Target, Watch, Bike } from 'lucide-react';
import { WorkoutHistoryItem, getWorkoutStats } from '../lib/workout-history';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

type Props = {
  user: {
    name: string;
    subscription: string;
    workoutsThisWeek: number;
  };
  history: WorkoutHistoryItem[];
};

export function Analytics({ user, history }: Props) {
  // Ensure history is an array
  const safeHistory = Array.isArray(history) ? history : [];
  const stats = getWorkoutStats(safeHistory);
  
  // Weekly activity data
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    
    const workoutsOnDay = safeHistory.filter(item => {
      if (!item.createdAt) return false;
      try {
        const itemDate = new Date(item.createdAt);
        if (isNaN(itemDate.getTime())) return false;
        return itemDate.toDateString() === date.toDateString();
      } catch {
        return false;
      }
    }).length;

    return {
      day: dayName,
      workouts: workoutsOnDay
    };
  });

  // Device distribution
  const deviceData = [
    { name: 'Garmin', value: stats.deviceCounts.garmin || 0, color: '#0ea5e9' },
    { name: 'Apple Watch', value: stats.deviceCounts.apple || 0, color: '#8b5cf6' },
    { name: 'Zwift', value: stats.deviceCounts.zwift || 0, color: '#f97316' }
  ].filter(d => d.value > 0);

  // Monthly trend
  const monthlyData = Array.from({ length: 4 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (i * 7));
    const weekLabel = `Week ${4 - i}`;
    
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - 7);
    
    const workoutsInWeek = safeHistory.filter(item => {
      if (!item.createdAt) return false;
      try {
        const itemDate = new Date(item.createdAt);
        if (isNaN(itemDate.getTime())) return false;
        return itemDate >= startOfWeek && itemDate <= date;
      } catch {
        return false;
      }
    }).length;

    return {
      week: weekLabel,
      workouts: workoutsInWeek
    };
  }).reverse();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl mb-2">Analytics</h2>
        <p className="text-muted-foreground">
          Your workout insights and progress
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total Workouts</CardTitle>
            <Dumbbell className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.totalWorkouts}</div>
            <p className="text-xs text-muted-foreground mt-1">
              All time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">This Week</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.thisWeek}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Last 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Avg Exercises</CardTitle>
            <Target className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.avgExercisesPerWorkout}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Per workout
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Subscription</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {user.subscription}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">
              {user.subscription === 'free' ? 'Free' : 'Pro'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Current plan
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Weekly Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="workouts" fill="#0ea5e9" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Device Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Device Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {deviceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={deviceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {deviceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No device data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle>4-Week Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="workouts" stroke="#8b5cf6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Quick Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.thisWeek > 0 && (
            <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-900 dark:text-green-100">
                  Great week!
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  You've created {stats.thisWeek} workout{stats.thisWeek !== 1 ? 's' : ''} this week
                </p>
              </div>
            </div>
          )}
          
          {stats.totalWorkouts === 0 && (
            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <Dumbbell className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  Get started!
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Create your first workout to start tracking your progress
                </p>
              </div>
            </div>
          )}

          {stats.avgExercisesPerWorkout > 0 && stats.avgExercisesPerWorkout < 5 && (
            <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
              <Target className="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <p className="font-medium text-orange-900 dark:text-orange-100">
                  Room to grow
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  Consider adding more exercises to maximize your workouts
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
