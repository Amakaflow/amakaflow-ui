import { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Crown, Flame, Plus, Trophy, Users } from 'lucide-react';

interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'distance' | 'workouts' | 'streak';
  progress: number;
  goal: number;
  unit: string;
  participants: number;
  endsIn: string;
  joined: boolean;
  rank?: number;
  leaderboard: { name: string; value: number; initials: string }[];
}

const MOCK_CHALLENGES: Challenge[] = [
  {
    id: '1',
    title: 'April 100 km Run',
    description: 'Log 100 km of running in April',
    type: 'distance',
    progress: 42,
    goal: 100,
    unit: 'km',
    participants: 214,
    endsIn: '18 days',
    joined: true,
    rank: 47,
    leaderboard: [
      { name: 'Jade O.', value: 88, initials: 'JO' },
      { name: 'Marcus L.', value: 76, initials: 'ML' },
      { name: 'Sofia H.', value: 71, initials: 'SH' },
    ],
  },
  {
    id: '2',
    title: '30-Day Strength',
    description: 'Complete 20 strength sessions in 30 days',
    type: 'workouts',
    progress: 9,
    goal: 20,
    unit: 'sessions',
    participants: 98,
    endsIn: '22 days',
    joined: true,
    rank: 12,
    leaderboard: [
      { name: 'Kwame A.', value: 18, initials: 'KA' },
      { name: 'Priya N.', value: 16, initials: 'PN' },
      { name: 'Ben T.', value: 15, initials: 'BT' },
    ],
  },
  {
    id: '3',
    title: 'Weekly Consistency',
    description: 'Maintain a 4-day workout streak each week',
    type: 'streak',
    progress: 3,
    goal: 4,
    unit: 'days this week',
    participants: 312,
    endsIn: '4 days',
    joined: false,
    leaderboard: [
      { name: 'Alex R.', value: 4, initials: 'AR' },
      { name: 'Cleo M.', value: 4, initials: 'CM' },
      { name: 'Omar D.', value: 4, initials: 'OD' },
    ],
  },
];

export function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>(MOCK_CHALLENGES);

  function toggleJoin(id: string) {
    setChallenges(prev =>
      prev.map(c =>
        c.id === id ? { ...c, joined: !c.joined, participants: c.joined ? c.participants - 1 : c.participants + 1 } : c,
      ),
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Challenges</h1>
          <p className="text-muted-foreground text-sm">Compete, push limits, earn badges</p>
        </div>
        <Button size="sm" variant="outline" className="gap-2" disabled>
          <Plus className="w-4 h-4" />
          Create
        </Button>
      </div>

      <div className="space-y-4">
        {challenges.map(c => {
          const pct = Math.min(100, Math.round((c.progress / c.goal) * 100));
          return (
            <Card key={c.id} className={c.joined ? 'border-primary/30' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-500 shrink-0" />
                    {c.title}
                  </CardTitle>
                  <Button
                    size="sm"
                    variant={c.joined ? 'secondary' : 'default'}
                    onClick={() => toggleJoin(c.id)}
                    className="shrink-0"
                  >
                    {c.joined ? 'Leave' : 'Join'}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">{c.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {c.joined && (
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Your progress</span>
                      <span>
                        {c.progress}/{c.goal} {c.unit}
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {c.participants} athletes
                  </span>
                  <span className="flex items-center gap-1">
                    <Flame className="w-3 h-3" />
                    Ends in {c.endsIn}
                  </span>
                  {c.rank && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      Rank #{c.rank}
                    </Badge>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Crown className="w-3 h-3 text-yellow-500" />
                    Leaderboard
                  </p>
                  <div className="space-y-1">
                    {c.leaderboard.map((entry, i) => (
                      <div key={entry.name} className="flex items-center gap-2 text-sm">
                        <span className="w-4 text-xs text-muted-foreground font-medium">{i + 1}.</span>
                        <span className="flex-1">{entry.name}</span>
                        <span className="font-semibold text-xs">
                          {entry.value} {c.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
