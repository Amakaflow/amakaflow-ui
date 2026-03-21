/** Source of a training session */
export type SessionSource = 'stryd' | 'amakaflow' | 'class' | 'manual';

/** Intensity level */
export type Intensity = 'easy' | 'moderate' | 'hard';

/** Session type (determines icon) */
export type SessionType = 'run' | 'strength' | 'class' | 'yoga' | 'rest';

/** Readiness tier derived from 0-100 score */
export type ReadinessTier = 'green' | 'amber' | 'red';

export interface SessionStep {
  label: string;
  duration: string;
  description: string;
}

export interface ActualData {
  avgPace?: string;
  avgPower?: number;
  avgHR?: number;
  duration: number; // minutes
  distance?: number; // km
  completed: boolean;
}

export interface TrainingSession {
  id: string;
  title: string;
  type: SessionType;
  source: SessionSource;
  duration: number; // minutes
  intensity: Intensity;
  status: 'planned' | 'completed' | 'skipped' | 'missed';
  /** Whether this session is locked (external source) */
  locked: boolean;
  /** Steps for expanded view */
  steps?: SessionStep[];
  /** AI rationale for placement */
  rationale?: string;
  /** Sync status text */
  syncStatus?: string;
  /** Actual workout data (if completed) */
  actual?: ActualData;
  /** Whether there is a conflict with another session */
  hasConflict?: boolean;
}

export interface DayState {
  date: Date;
  dayLabel: string; // "Mon", "Tue", etc.
  dateLabel: string; // "17 Mar"
  readinessScore: number; // 0-100
  readinessTier: ReadinessTier;
  sessions: TrainingSession[];
  hasConflict: boolean;
}

/** Conflict warning from the planner */
export interface ConflictWarning {
  date: Date;
  message: string;
  suggestion?: string;
}

export interface WeekState {
  days: DayState[];
  weekLabel: string; // "17 - 23 Mar 2026"
  completedCount: number;
  totalPlanned: number;
  /** Whether the week has been generated via the planner */
  generated: boolean;
  /** Conflict warnings from the energy planner */
  conflicts: ConflictWarning[];
}
