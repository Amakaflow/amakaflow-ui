import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Award, CheckCircle2, Flame, Star, Target, Trophy, Zap } from 'lucide-react';

interface BadgeItem {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  earned: boolean;
  earnedDate?: string;
  color: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  date: string;
  xp: number;
}

interface WeeklyGoal {
  id: string;
  label: string;
  progress: number;
  goal: number;
  unit: string;
  done: boolean;
}

const MOCK_BADGES: BadgeItem[] = [
  { id: '1', name: 'First Steps',   description: 'Log your first workout',        icon: Star,     earned: true,  earnedDate: 'Mar 2',  color: 'text-yellow-500' },
  { id: '2', name: '7-Day Streak',  description: 'Work out 7 days in a row',       icon: Flame,    earned: true,  earnedDate: 'Mar 15', color: 'text-orange-500' },
  { id: '3', name: 'Century Club',  description: 'Log 100 workouts',               icon: Trophy,   earned: true,  earnedDate: 'Mar 28', color: 'text-purple-500' },
  { id: '4', name: 'Speed Demon',   description: 'Run a sub-5 min/km pace',        icon: Zap,      earned: true,  earnedDate: 'Mar 30', color: 'text-blue-500' },
  { id: '5', name: 'Iron Will',     description: 'Complete a 30-day challenge',    icon: Award,    earned: false, color: 'text-muted-foreground' },
  { id: '6', name: 'Half-Century',  description: 'Log 50 km in a single week',     icon: Target,   earned: false, color: 'text-muted-foreground' },
];

const MOCK_ACHIEVEMENTS: Achievement[] = [
  { id: '1', title: 'New 5 km PR',         description: 'Ran 5 km in 23:41',                 date: 'Today',     xp: 150 },
  { id: '2', title: 'Weekly Goal Crushed', description: 'Hit all 4 weekly goals',             date: 'Yesterday', xp: 200 },
  { id: '3', title: 'Strength Milestone',  description: 'Bench pressed 100 kg for the first time', date: 'Mar 30', xp: 300 },
  { id: '4', title: '10-Day Streak',       description: 'Worked out 10 days in a row',        date: 'Mar 28',    xp: 250 },
];

const MOCK_GOALS: WeeklyGoal[] = [
  { id: '1', label: 'Workouts',    progress: 3,  goal: 4,   unit: 'sessions', done: false },
  { id: '2', label: 'Running',     progress: 22, goal: 20,  unit: 'km',       done: true  },
  { id: '3', label: 'Strength',    progress: 2,  goal: 2,   unit: 'sessions', done: true  },
  { id: '4', label: 'Active days', progress: 4,  goal: 5,   unit: 'days',     done: false },
];

export function GamificationPage() {
  const currentXp    = 3_840;
  const nextLevelXp  = 5_000;
  const level        = 8;
  const streak       = 10;
  const xpProgress   = Math.round((currentXp / nextLevelXp) * 100);

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Progress & Achievements</h1>
        <p className="text-muted-foreground text-sm">Track your streaks, badges, and XP</p>
      </div>

      {/* XP + Streak */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Level</p>
                <p className="text-4xl font-extrabold leading-none mt-1">{level}</p>
              </div>
              <Star className="w-8 h-8 text-yellow-500 mt-1" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{currentXp.toLocaleString()} XP</span>
                <span>{nextLevelXp.toLocaleString()} XP</span>
              </div>
              <Progress value={xpProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">{nextLevelXp - currentXp} XP to Level {level + 1}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4 px-5 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
              <Flame className="w-8 h-8 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Current Streak</p>
              <p className="text-4xl font-extrabold leading-none mt-1">
                {streak}
                <span className="text-base font-normal text-muted-foreground ml-1">days</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">Personal best: 14 days</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly goals */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Weekly Goals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {MOCK_GOALS.map(g => {
            const pct = Math.min(100, Math.round((g.progress / g.goal) * 100));
            return (
              <div key={g.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    {g.done && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                    {g.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {g.progress}/{g.goal} {g.unit}
                  </span>
                </div>
                <Progress value={pct} className={`h-1.5 ${g.done ? '[&>[data-slot=progress-indicator]]:bg-green-500' : ''}`} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Badges */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-500" />
            Badges
            <Badge variant="secondary" className="ml-auto font-normal text-xs">
              {MOCK_BADGES.filter(b => b.earned).length}/{MOCK_BADGES.length} earned
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {MOCK_BADGES.map(b => {
              const Icon = b.icon;
              return (
                <div
                  key={b.id}
                  className={`rounded-lg border p-3 flex flex-col items-center text-center gap-2 transition-opacity ${
                    b.earned ? 'opacity-100' : 'opacity-40'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${b.earned ? 'bg-muted' : 'bg-muted/50'}`}>
                    <Icon className={`w-5 h-5 ${b.color}`} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{b.name}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{b.description}</p>
                    {b.earnedDate && (
                      <p className="text-[10px] text-muted-foreground mt-1">Earned {b.earnedDate}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent achievements */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            Recent Achievements
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {MOCK_ACHIEVEMENTS.map(a => (
            <div key={a.id} className="flex items-center justify-between py-3 gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{a.title}</p>
                <p className="text-xs text-muted-foreground truncate">{a.description}</p>
              </div>
              <div className="text-right shrink-0">
                <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-200 dark:border-yellow-800 font-semibold text-xs">
                  +{a.xp} XP
                </Badge>
                <p className="text-[10px] text-muted-foreground mt-1">{a.date}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
