import { useState } from 'react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ChevronRight, Dumbbell, Plus, Users } from 'lucide-react';

interface CrewMember {
  name: string;
  initials: string;
  role: 'captain' | 'member';
}

interface Crew {
  id: string;
  name: string;
  description: string;
  members: CrewMember[];
  recentActivity: string;
  joined: boolean;
}

const MOCK_CREWS: Crew[] = [
  {
    id: '1',
    name: 'Morning Crushers',
    description: 'Early risers who get it done before 7 AM.',
    members: [
      { name: 'Jade Okonkwo',  initials: 'JO', role: 'captain' },
      { name: 'Marcus Levin',  initials: 'ML', role: 'member' },
      { name: 'Sofia Herrera', initials: 'SH', role: 'member' },
      { name: 'You',           initials: 'ME', role: 'member' },
    ],
    recentActivity: 'Jade logged a 10 km run',
    joined: true,
  },
  {
    id: '2',
    name: 'Strength Squad',
    description: 'Powerlifting-focused athletes chasing PRs.',
    members: [
      { name: 'Kwame Asante', initials: 'KA', role: 'captain' },
      { name: 'Ben Torres',   initials: 'BT', role: 'member' },
      { name: 'Priya Nair',   initials: 'PN', role: 'member' },
    ],
    recentActivity: 'Kwame hit a new squat PR',
    joined: true,
  },
  {
    id: '3',
    name: 'Tri Warriors',
    description: 'Triathlon training — swim, bike, run.',
    members: [
      { name: 'Omar Diallo', initials: 'OD', role: 'captain' },
      { name: 'Cleo Mills',  initials: 'CM', role: 'member' },
    ],
    recentActivity: 'Omar finished a 40 km bike',
    joined: false,
  },
];

export function CrewsPage() {
  const [crews, setCrews] = useState<Crew[]>(MOCK_CREWS);
  const [expanded, setExpanded] = useState<string | null>(null);

  function toggleJoin(id: string) {
    setCrews(prev => prev.map(c => (c.id === id ? { ...c, joined: !c.joined } : c)));
  }

  const myCrews   = crews.filter(c => c.joined);
  const otherCrews = crews.filter(c => !c.joined);

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Crews</h1>
          <p className="text-muted-foreground text-sm">Train together, level up together</p>
        </div>
        <Button size="sm" variant="outline" className="gap-2" disabled>
          <Plus className="w-4 h-4" />
          Create Crew
        </Button>
      </div>

      {myCrews.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">My Crews</h2>
          {myCrews.map(crew => (
            <CrewCard
              key={crew.id}
              crew={crew}
              expanded={expanded === crew.id}
              onToggleExpand={() => setExpanded(prev => (prev === crew.id ? null : crew.id))}
              onToggleJoin={() => toggleJoin(crew.id)}
            />
          ))}
        </section>
      )}

      {otherCrews.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Discover Crews</h2>
          {otherCrews.map(crew => (
            <CrewCard
              key={crew.id}
              crew={crew}
              expanded={expanded === crew.id}
              onToggleExpand={() => setExpanded(prev => (prev === crew.id ? null : crew.id))}
              onToggleJoin={() => toggleJoin(crew.id)}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function CrewCard({
  crew,
  expanded,
  onToggleExpand,
  onToggleJoin,
}: {
  crew: Crew;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleJoin: () => void;
}) {
  return (
    <Card className={crew.joined ? 'border-primary/30' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary shrink-0" />
              {crew.name}
              {crew.joined && (
                <Badge variant="secondary" className="text-xs ml-1">Joined</Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">{crew.description}</p>
          </div>
          <Button
            size="sm"
            variant={crew.joined ? 'secondary' : 'default'}
            onClick={onToggleJoin}
            className="shrink-0"
          >
            {crew.joined ? 'Leave' : 'Join'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Dumbbell className="w-3 h-3" />
          <span>{crew.recentActivity}</span>
        </div>

        <div className="flex items-center gap-1">
          {crew.members.slice(0, 5).map(m => (
            <Avatar key={m.name} className="w-7 h-7 -ml-1 first:ml-0 border-2 border-background">
              <AvatarFallback className="text-[10px] font-semibold">{m.initials}</AvatarFallback>
            </Avatar>
          ))}
          <span className="text-xs text-muted-foreground ml-2">
            {crew.members.length} members
          </span>
          <button
            onClick={onToggleExpand}
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? 'Hide' : 'View all'}
            <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        </div>

        {expanded && (
          <div className="space-y-2 pt-2 border-t">
            {crew.members.map(m => (
              <div key={m.name} className="flex items-center gap-2 text-sm">
                <Avatar className="w-6 h-6">
                  <AvatarFallback className="text-[10px]">{m.initials}</AvatarFallback>
                </Avatar>
                <span className="flex-1">{m.name}</span>
                {m.role === 'captain' && (
                  <Badge variant="outline" className="text-xs">Captain</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
