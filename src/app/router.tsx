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
  | 'exercise-history'
  | 'volume-analytics'
  | 'program-detail'
  | 'programs'
  | 'create-ai';

export const Analytics = lazy(() =>
  import('../components/Analytics').then(m => ({ default: m.Analytics }))
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

export const ExerciseHistory = lazy(() =>
  import('../components/ExerciseHistory').then(m => ({ default: m.ExerciseHistory }))
);

export const VolumeAnalytics = lazy(() =>
  import('../components/VolumeAnalytics').then(m => ({ default: m.VolumeAnalytics }))
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
