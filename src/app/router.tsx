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
  | 'training-preferences'
  | 'dashboard'
  | 'nutrition'
  | 'social'
  | 'challenges'
  | 'crews'
  | 'gamification'
  | 'more';

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

export const StravaCallbackPage = lazy(() =>
  import('../components/Connections').then(m => ({ default: m.StravaCallback }))
);

export const CoachChat = lazy(() =>
  import('../components/CoachChat').then(m => ({ default: m.CoachChat }))
);

export const SyncDashboardPage = lazy(() =>
  import('../components/SyncDashboard').then(m => ({ default: m.SyncDashboard }))
);

export const TrainingPreferencesPage = lazy(() =>
  import('../components/TrainingPreferences').then(m => ({ default: m.TrainingPreferencesPage }))
);

export const NutritionPage = lazy(() =>
  import('../components/Nutrition/NutritionPage').then(m => ({ default: m.NutritionPage }))
);

export const SocialFeedPage = lazy(() =>
  import('../components/Social/SocialFeedPage').then(m => ({ default: m.SocialFeedPage }))
);

export const ChallengesPage = lazy(() =>
  import('../components/Social/ChallengesPage').then(m => ({ default: m.ChallengesPage }))
);

export const CrewsPage = lazy(() =>
  import('../components/Social/CrewsPage').then(m => ({ default: m.CrewsPage }))
);

export const GamificationPage = lazy(() =>
  import('../components/Gamification/GamificationPage').then(m => ({ default: m.GamificationPage }))
);

export const MorePage = lazy(() =>
  import('../components/MorePage').then(m => ({ default: m.MorePage }))
);
