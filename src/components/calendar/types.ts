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

/** View layer toggle */
export type ViewLayer = 'planned' | 'actuals';

// --- AMA-1118 Conflict detection types ---

/** Conflict type returned by POST /planning/detect-conflicts */
export type ConflictType =
  | 'pre_fatigue'
  | 'consecutive_hard'
  | 'same_muscle_group'
  | 'overload'
  | 'no_recovery';

/** Conflict severity */
export type ConflictSeverity = 'warning' | 'critical';

/** A suggested fix action */
export interface SuggestedFix {
  label: string;
  action: 'move' | 'downgrade' | 'keep';
  sessionId?: string;
  targetDate?: string;
  targetIntensity?: string;
}

/** A detected scheduling conflict (AMA-1118) */
export interface SchedulingConflict {
  type: ConflictType;
  severity: ConflictSeverity;
  message: string;
  affectedSessionIds: string[];
  affectedDates: string[];
  suggestedFixes: SuggestedFix[];
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

// --- Plan Preview types (AMA-1128) ---

/** The kind of change the AI proposes */
export type ProposedChangeKind = 'new' | 'moved' | 'removed';

/** A single proposed session change */
export interface ProposedSession {
  /** Unique id for this proposal */
  id: string;
  /** Underlying session (new or existing) */
  session: TrainingSession;
  /** What kind of change this is */
  kind: ProposedChangeKind;
  /** AI rationale for the change */
  rationale: string;
  /** For moved sessions: original day index */
  fromDayIndex?: number;
  /** Target day index in the week */
  toDayIndex: number;
}

/** Summary of a proposed plan */
export interface PlanSummaryData {
  added: number;
  moved: number;
  removed: number;
  totalWeeklyVolume: string; // e.g. "6h 30min"
  hardDaysUsed: number;
  hardDaysCap: number;
  warnings: string[];
}

/** The full proposed plan preview state */
export interface PlanPreviewState {
  /** Whether the preview overlay is showing */
  active: boolean;
  /** All proposed changes */
  proposals: ProposedSession[];
  /** Summary stats */
  summary: PlanSummaryData;
}
