import {
  CalendarDays,
  Dumbbell,
  Home,
  BarChart3,
  Menu,
} from 'lucide-react';
import type { View } from '../app/router';

export interface BottomNavProps {
  currentView: View;
  onNavigate: (view: View) => void;
}

interface NavTab {
  id: View;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Views that should highlight this tab */
  matchViews?: View[];
}

const TABS: NavTab[] = [
  { id: 'home', label: 'Home', icon: Home, matchViews: ['home', 'import', 'workflow', 'create-ai'] },
  { id: 'workouts', label: 'Workouts', icon: Dumbbell },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'More', icon: Menu, matchViews: ['settings', 'help', 'programs', 'strava-enhance', 'mobile-companion', 'team', 'program-detail', 'export-page', 'connections', 'coach'] },
];

function isActive(tab: NavTab, currentView: View): boolean {
  if (tab.id === currentView) return true;
  return tab.matchViews?.includes(currentView) ?? false;
}

export function BottomNav({ currentView, onNavigate }: BottomNavProps) {
  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-[45] border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
    >
      <div className="flex items-center justify-around h-16 px-1 pb-safe">
        {TABS.map((tab) => {
          const active = isActive(tab, currentView);
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {active && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </div>
              <span className={`text-[10px] leading-tight ${active ? 'font-semibold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
