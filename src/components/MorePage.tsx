import {
  ChevronRight,
  Brain,
  Apple,
  Rss,
  Trophy,
  Users,
  BarChart3,
  Star,
  Settings,
  HelpCircle,
  Link2,
  BookOpen,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { View } from '../app/router';
import { VIEW_TO_PATH } from '../hooks/useUrlSync';

interface MoreItem {
  id: View;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MoreGroup {
  title: string;
  items: MoreItem[];
}

const GROUPS: MoreGroup[] = [
  {
    title: 'Features',
    items: [
      { id: 'coach', label: 'Coach', description: 'AI-powered training guidance', icon: Brain },
      { id: 'nutrition', label: 'Nutrition', description: 'Track macros and meal plans', icon: Apple },
    ],
  },
  {
    title: 'Community',
    items: [
      { id: 'social', label: 'Feed', description: 'Activity from people you follow', icon: Rss },
      { id: 'challenges', label: 'Challenges', description: 'Compete in fitness challenges', icon: Trophy },
      { id: 'crews', label: 'Crews', description: 'Train with your crew', icon: Users },
    ],
  },
  {
    title: 'Insights',
    items: [
      { id: 'analytics', label: 'Analytics', description: 'Performance trends and data', icon: BarChart3 },
      { id: 'gamification', label: 'Progress', description: 'Badges, streaks, and milestones', icon: Star },
    ],
  },
  {
    title: 'Settings & More',
    items: [
      { id: 'settings', label: 'Settings', description: 'Account and app preferences', icon: Settings },
      { id: 'help', label: 'Help', description: 'Guides and support', icon: HelpCircle },
      { id: 'connections', label: 'Connections', description: 'Connected apps and devices', icon: Link2 },
      { id: 'programs', label: 'Programs', description: 'Training plans and programs', icon: BookOpen },
    ],
  },
];

export function MorePage() {
  const nav = useNavigate();

  const handleNavigate = (view: View) => {
    const path = VIEW_TO_PATH[view] || '/';
    nav(path);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">More</h1>

      <div className="space-y-6">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
              {group.title}
            </h2>
            <div className="rounded-xl border bg-card overflow-hidden divide-y divide-border">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-accent transition-colors"
                  >
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                    </div>
                    <ChevronRight className="flex-shrink-0 w-4 h-4 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
