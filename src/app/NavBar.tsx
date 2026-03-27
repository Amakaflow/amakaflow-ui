import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Dumbbell,
  FolderOpen,
  HelpCircle,
  LayoutDashboard,
  Plus,
  Settings,
  Sparkles,
} from 'lucide-react';
import { isDemoMode } from '../lib/demo-mode';
import type { AppUser } from './useAppAuth';
import type { View } from './router';
import { VIEW_TO_PATH, pathToView } from '../hooks/useUrlSync';

export interface NavBarProps {
  user: AppUser;
  currentView?: View;
  stravaConnected: boolean;
  hasClerk: boolean;
  onNavigate?: (view: View) => void;
}

export function NavBar({
  user,
  currentView: currentViewProp,
  stravaConnected,
  hasClerk,
  onNavigate: onNavigateProp,
}: NavBarProps) {
  const nav = useNavigate();
  const location = useLocation();

  const currentView: View = currentViewProp ?? pathToView(location.pathname);

  const handleNavigate = (view: View) => {
    if (onNavigateProp) {
      onNavigateProp(view);
    } else {
      const path = VIEW_TO_PATH[view] || '/';
      nav(path);
    }
  };

  const isCreateActive = currentView === 'workflow' || currentView === 'import' || currentView === 'create-ai';
  const isTrainingActive = currentView === 'calendar' || currentView === 'workouts' || currentView === 'programs';
  const isInsightsActive = currentView === 'analytics' || currentView === 'dashboard';

  return (
    <div className="hidden md:block border-b bg-card">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 min-w-0">
            <div className="flex items-center gap-3 shrink-0">
              <Button
                variant="ghost"
                className="p-0 h-auto hover:bg-transparent"
                onClick={() => handleNavigate('home')}
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

            <nav className="hidden md:flex items-center gap-1">
              {/* Dashboard - direct */}
              <Button
                variant={currentView === 'dashboard' ? 'default' : 'ghost'}
                size="sm"
                data-assistant-target="nav-dashboard"
                onClick={() => handleNavigate('dashboard')}
                className="gap-2"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Button>

              {/* Create dropdown: Import, Create with AI */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={isCreateActive ? 'default' : 'ghost'}
                    size="sm"
                    className="gap-1"
                    data-testid="nav-create-menu"
                  >
                    <Plus className="w-4 h-4" />
                    Create
                    <ChevronDown className="w-3 h-3 ml-0.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => handleNavigate('import')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Import Workout
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleNavigate('create-ai')}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Create with AI
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Training dropdown: Calendar, My Workouts, Programs */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={isTrainingActive ? 'default' : 'ghost'}
                    size="sm"
                    className="gap-1"
                    data-testid="nav-training-menu"
                  >
                    <Dumbbell className="w-4 h-4" />
                    Training
                    <ChevronDown className="w-3 h-3 ml-0.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={() => handleNavigate('calendar')}
                    data-assistant-target="nav-calendar"
                  >
                    <CalendarDays className="w-4 h-4 mr-2" />
                    Calendar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleNavigate('workouts')}
                    data-assistant-target="nav-library"
                  >
                    <Dumbbell className="w-4 h-4 mr-2" />
                    My Workouts
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleNavigate('programs')}
                    data-assistant-target="nav-programs"
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Programs
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Insights dropdown: Analytics, Dashboard */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={isInsightsActive ? 'default' : 'ghost'}
                    size="sm"
                    className="gap-1"
                    data-testid="nav-insights-menu"
                    data-assistant-target="nav-analytics"
                  >
                    <BarChart3 className="w-4 h-4" />
                    Insights
                    <ChevronDown className="w-3 h-3 ml-0.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => handleNavigate('analytics')}>
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Analytics
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleNavigate('dashboard')}>
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Sync Dashboard
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {stravaConnected && (
                <Button
                  variant={currentView === 'strava-enhance' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleNavigate('strava-enhance')}
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
              onClick={() => handleNavigate('help')}
              className="gap-2"
            >
              <HelpCircle className="w-4 h-4" />
              Help
            </Button>
            <Button
              variant="ghost"
              size="sm"
              data-assistant-target="nav-settings"
              onClick={() => handleNavigate('settings')}
              className="gap-2"
            >
              <Settings className="w-4 h-4" />
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
