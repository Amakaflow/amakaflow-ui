import { lazy } from 'react';

export type View =
  | 'home'
  | 'workflow'
  | 'profile'
  | 'analytics'
  | 'team'
  | 'settings'
  | 'strava-enhance'
  | 'calendar'
  | 'workouts'
  | 'mobile-companion'
  | 'import'
  | 'help'
  | 'program-detail'
  | 'programs'
  | 'create-ai'
  | 'export-page'
  | 'connections'
  | 'coach'
  | 'dashboard';

export const AnalyticsHub = lazy(() =>
  import('../components/AnalyticsHub').then(m => ({ default: m.AnalyticsHub }))
);

export const UserSettings = lazy(() =>
  import('../components/UserSettings').then(m => ({ default: m.UserSettings }))
);

export const StravaEnhance = lazy(() =>
  import('../components/StravaEnhance').then(m => ({ default: m.StravaEnhance }))
);

export const Calendar = lazy(() =>
  import('../components/Calendar').then(m => ({ default: m.Calendar }))
);

export const WorkoutList = lazy(() =>
  import('../components/Workouts/WorkoutList').then(m => ({ default: m.WorkoutList }))
);

export const MobileCompanion = lazy(() =>
  import('../components/MobileCompanion').then(m => ({ default: m.MobileCompanion }))
);

export const ImportScreen = lazy(() =>
  import('../components/Import').then(m => ({ default: m.ImportScreen }))
);

export const HelpPage = lazy(() =>
  import('../components/help/HelpPage').then(m => ({ default: m.HelpPage }))
);

export const ProgramDetail = lazy(() =>
  import('../components/ProgramDetail').then(m => ({ default: m.ProgramDetail }))
);

export const ProgramsList = lazy(() =>
  import('../components/ProgramsList').then(m => ({ default: m.ProgramsList }))
);

export const CreateAIWorkout = lazy(() =>
  import('../components/CreateAIWorkout').then(m => ({ default: m.CreateAIWorkout }))
);

export const ConnectionsPage = lazy(() =>
  import('../components/Connections').then(m => ({ default: m.ConnectionsPage }))
);

export const CoachChat = lazy(() =>
  import('../components/CoachChat').then(m => ({ default: m.CoachChat }))
);

export const SyncDashboardPage = lazy(() =>
  import('../components/SyncDashboard').then(m => ({ default: m.SyncDashboard }))
);
