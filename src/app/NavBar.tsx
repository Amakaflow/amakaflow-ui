import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Activity,
  BarChart3,
  CalendarDays,
  Dumbbell,
  FolderOpen,
  HelpCircle,
  Plus,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { isDemoMode } from '../lib/demo-mode';
import type { AppUser } from './useAppAuth';
import type { View } from './router';

export interface NavBarProps {
  user: AppUser;
  currentView: View;
  stravaConnected: boolean;
  hasClerk: boolean;
  onNavigate: (view: View) => void;
}

export function NavBar({
  user,
  currentView,
  stravaConnected,
  hasClerk,
  onNavigate,
}: NavBarProps) {
  return (
    <div className="border-b bg-card">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 min-w-0">
            <div className="flex items-center gap-3 shrink-0">
              <Button
                variant="ghost"
                className="p-0 h-auto hover:bg-transparent"
                onClick={() => onNavigate('home')}
              >
                <div className="flex items-center gap-3">
                  <img
                    src="/logo.png"
                    alt="AmakaFlow"
                    className="w-8 h-8 rounded-lg object-contain"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">AmakaFlow</span>
                      <Badge variant="secondary" className="text-xs">
                        {user.subscription}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{user.name}</p>
                  </div>
                </div>
              </Button>
            </div>

            <nav className="hidden md:flex items-center gap-1 overflow-x-auto">
              <Button
                variant={(currentView === 'workflow' || currentView === 'import') ? 'default' : 'ghost'}
                size="sm"
                className="gap-1"
                onClick={() => onNavigate('import')}
              >
                <Plus className="w-4 h-4" />
                Import
              </Button>
              <Button
                variant={currentView === 'create-ai' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onNavigate('create-ai')}
                className="gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Create with AI
              </Button>
              <Button
                variant={currentView === 'calendar' ? 'default' : 'ghost'}
                size="sm"
                data-assistant-target="nav-calendar"
                onClick={() => onNavigate('calendar')}
                className="gap-2"
              >
                <CalendarDays className="w-4 h-4" />
                Calendar
              </Button>
              <Button
                variant={currentView === 'workouts' ? 'default' : 'ghost'}
                size="sm"
                data-assistant-target="nav-library"
                onClick={() => onNavigate('workouts')}
                className="gap-2"
              >
                <Dumbbell className="w-4 h-4" />
                My Workouts
              </Button>
              <Button
                variant={currentView === 'programs' ? 'default' : 'ghost'}
                size="sm"
                data-assistant-target="nav-programs"
                onClick={() => onNavigate('programs')}
                className="gap-2"
              >
                <FolderOpen className="w-4 h-4" />
                Programs
              </Button>
              <Button
                variant={currentView === 'analytics' ? 'default' : 'ghost'}
                size="sm"
                data-assistant-target="nav-analytics"
                onClick={() => onNavigate('analytics')}
                className="gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                Analytics
              </Button>
              <Button
                variant={currentView === 'exercise-history' ? 'default' : 'ghost'}
                size="sm"
                data-assistant-target="nav-history"
                onClick={() => onNavigate('exercise-history')}
                className="gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                History
              </Button>
              <Button
                variant={currentView === 'volume-analytics' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onNavigate('volume-analytics')}
                className="gap-2"
              >
                <Activity className="w-4 h-4" />
                Volume
              </Button>
              <Button
                variant={currentView === 'team' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onNavigate('team')}
                className="gap-2"
              >
                <Users className="w-4 h-4" />
                Team
              </Button>
              {stravaConnected && (
                <Button
                  variant={currentView === 'strava-enhance' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onNavigate('strava-enhance')}
                  className="gap-2 text-orange-600 hover:text-orange-600"
                >
                  <Activity className="w-4 h-4" />
                  Enhance Strava
                </Button>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant={currentView === 'help' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onNavigate('help')}
              className="gap-2"
            >
              <HelpCircle className="w-4 h-4" />
              Help
            </Button>
            <Button
              variant="ghost"
              size="sm"
              data-assistant-target="nav-settings"
              onClick={() => onNavigate('settings')}
              className="gap-2"
            >
              <Settings className="w-4 h-4" />
              Settings
            </Button>
            {isDemoMode ? (
              <span className="text-sm font-medium text-muted-foreground px-2">
                {user?.name ?? 'Demo User'}
              </span>
            ) : hasClerk ? (
              <>
                <SignedIn><UserButton afterSignOutUrl="/" /></SignedIn>
                <SignedOut>
                  <SignInButton mode="modal"><Button variant="outline" size="sm">Sign in</Button></SignInButton>
                  <SignUpButton mode="modal"><Button size="sm">Sign up</Button></SignUpButton>
                </SignedOut>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
