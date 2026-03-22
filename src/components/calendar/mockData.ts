import type { ConflictWarning, DayState, TrainingSession, WeekState, PlanPreviewState, ProposedSession, PlanSummaryData, SchedulingConflict } from './types';
import type { ConflictWarning, DayState, TrainingSession, WeekState, PlanPreviewState, ProposedSession, PlanSummaryData } from './types';

function makeDate(dayOffset: number): Date {
  const base = new Date(2026, 2, 16);
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  return d;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatDateLabel(d: Date): string {
  return `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}`;
}

const tuesdayRun: TrainingSession = {
  id: 'tue-run-1',
  title: 'Tempo Run',
  type: 'run',
  source: 'stryd',
  duration: 45,
  intensity: 'moderate',
  status: 'completed',
  locked: true,
  steps: [
    { label: 'Warm-up', duration: '10 min', description: 'Easy jog at 5:30/km' },
    { label: 'Tempo', duration: '25 min', description: '3x8min at 4:30/km, 1min rest' },
    { label: 'Cool-down', duration: '10 min', description: 'Walk to HR <120' },
  ],
  rationale: 'Stryd auto-scheduled: tempo session placed after rest day for optimal recovery.',
  syncStatus: 'Synced from Stryd 2h ago',
  actual: { avgPace: '4:28/km', avgPower: 265, avgHR: 162, duration: 44, distance: 9.8, completed: true },
};

const wednesdayStrength: TrainingSession = {
  id: 'wed-strength-1',
  title: 'Full Body Strength',
  type: 'strength',
  source: 'amakaflow',
  duration: 60,
  intensity: 'hard',
  status: 'planned',
  locked: false,
  steps: [
    { label: 'Warm-up', duration: '10 min', description: 'Dynamic stretching + mobility' },
    { label: 'Block A', duration: '20 min', description: 'Squats 4x6, RDL 4x8' },
    { label: 'Block B', duration: '20 min', description: 'Bench 4x6, Rows 4x8' },
    { label: 'Finisher', duration: '10 min', description: 'Core circuit: plank, dead bugs, pallof press' },
  ],
  rationale: 'AI placed this here because Wednesday is 48h after your last lower body work and readiness is projected high.',
  syncStatus: 'Ready to export to Garmin',
  hasConflict: true,
};

const thursdayEasyRun: TrainingSession = {
  id: 'thu-run-1',
  title: 'Easy Recovery Run',
  type: 'run',
  source: 'amakaflow',
  duration: 30,
  intensity: 'easy',
  status: 'planned',
  locked: false,
  steps: [{ label: 'Run', duration: '30 min', description: 'Zone 2 effort, nasal breathing' }],
  rationale: "AI placed this here: easy effort to promote blood flow after yesterday's strength session.",
  syncStatus: 'Not yet synced',
};

const thursdayClass: TrainingSession = {
  id: 'thu-class-1',
  title: 'Spin Class',
  type: 'class',
  source: 'class',
  duration: 45,
  intensity: 'moderate',
  status: 'planned',
  locked: true,
  rationale: 'Recurring class from your gym schedule.',
  syncStatus: 'Linked to Google Calendar',
  hasConflict: true,
};

const mondayMissedRun: TrainingSession = {
  id: 'mon-run-missed',
  title: 'Interval Run',
  type: 'run',
  source: 'stryd',
  duration: 50,
  intensity: 'hard',
  status: 'missed',
  locked: true,
  steps: [
    { label: 'Warm-up', duration: '10 min', description: 'Easy jog' },
    { label: 'Intervals', duration: '30 min', description: '6x800m at 3:50/km, 400m jog' },
    { label: 'Cool-down', duration: '10 min', description: 'Walk' },
  ],
  rationale: 'Stryd prescribed interval session for speed development.',
  syncStatus: 'Synced from Stryd -- not completed',
};

const saturdayLongRun: TrainingSession = {
  id: 'sat-run-1',
  title: 'Long Run',
  type: 'run',
  source: 'stryd',
  duration: 90,
  intensity: 'moderate',
  status: 'completed',
  locked: true,
  steps: [
    { label: 'Warm-up', duration: '10 min', description: 'Easy jog' },
    { label: 'Steady', duration: '70 min', description: 'Hold 5:15/km, power 240-250W' },
    { label: 'Cool-down', duration: '10 min', description: 'Walk' },
  ],
  rationale: 'Stryd prescribed long run: key weekly session for marathon prep.',
  syncStatus: 'Synced from Stryd 5h ago',
  actual: { avgPace: '5:12/km', avgPower: 248, avgHR: 148, duration: 88, distance: 16.9, completed: true },
};

const sundayYoga: TrainingSession = {
  id: 'sun-yoga-1',
  title: 'Recovery Yoga',
  type: 'yoga',
  source: 'manual',
  duration: 30,
  intensity: 'easy',
  status: 'planned',
  locked: false,
  steps: [
    { label: 'Flow', duration: '20 min', description: 'Gentle vinyasa flow' },
    { label: 'Savasana', duration: '10 min', description: 'Relaxation & breathing' },
  ],
  rationale: 'Manually added: recovery before the new training week.',
};

const mockConflicts: ConflictWarning[] = [
  {
    date: makeDate(2),
    message: 'You have a hard Stryd interval Tuesday and a heavy lower session Wednesday -- want to move the lower to Thursday?',
    suggestion: 'Move Full Body Strength to Thursday for 48h recovery.',
  },
];

export const mockDays: DayState[] = [
  { date: makeDate(0), dayLabel: DAYS[0], dateLabel: formatDateLabel(makeDate(0)), readinessScore: 85, readinessTier: 'green', sessions: [mondayMissedRun], hasConflict: false },
  { date: makeDate(1), dayLabel: DAYS[1], dateLabel: formatDateLabel(makeDate(1)), readinessScore: 78, readinessTier: 'green', sessions: [tuesdayRun], hasConflict: false },
  { date: makeDate(2), dayLabel: DAYS[2], dateLabel: formatDateLabel(makeDate(2)), readinessScore: 65, readinessTier: 'amber', sessions: [wednesdayStrength], hasConflict: true },
  { date: makeDate(3), dayLabel: DAYS[3], dateLabel: formatDateLabel(makeDate(3)), readinessScore: 60, readinessTier: 'amber', sessions: [thursdayEasyRun, thursdayClass], hasConflict: true },
  { date: makeDate(4), dayLabel: DAYS[4], dateLabel: formatDateLabel(makeDate(4)), readinessScore: 38, readinessTier: 'red', sessions: [], hasConflict: false },
  { date: makeDate(5), dayLabel: DAYS[5], dateLabel: formatDateLabel(makeDate(5)), readinessScore: 80, readinessTier: 'green', sessions: [saturdayLongRun], hasConflict: false },
  { date: makeDate(6), dayLabel: DAYS[6], dateLabel: formatDateLabel(makeDate(6)), readinessScore: 55, readinessTier: 'amber', sessions: [sundayYoga], hasConflict: false },
];

export function getMockWeekState(): WeekState {
  const allSessions = mockDays.flatMap(d => d.sessions);
  return {
    days: mockDays,
    weekLabel: '16 - 22 Mar 2026',
    completedCount: allSessions.filter(s => s.status === 'completed').length,
    totalPlanned: allSessions.filter(s => s.status !== 'missed').length,
    generated: false,
    conflicts: [],
  };
}

export function getGeneratedWeekState(): WeekState {
  return {
    days: mockDays,
    weekLabel: '16 - 22 Mar 2026',
    completedCount: mockDays.flatMap(d => d.sessions).filter(s => s.status === 'completed').length,
    totalPlanned: mockDays.flatMap(d => d.sessions).filter(s => s.status !== 'missed').length,
    generated: true,
    conflicts: mockConflicts,
  };
}

// --- Mock proposed plan for AMA-1128 plan preview ---

const newStrengthMonday: TrainingSession = {
  id: 'proposed-new-strength-mon',
  title: 'Upper Body Strength',
  type: 'strength',
  source: 'amakaflow',
  duration: 50,
  intensity: 'hard',
  status: 'planned',
  locked: false,
  steps: [
    { label: 'Warm-up', duration: '8 min', description: 'Band pull-aparts, arm circles' },
    { label: 'Block A', duration: '20 min', description: 'Bench 4x5, OHP 3x8' },
    { label: 'Block B', duration: '15 min', description: 'Rows 4x8, Curls 3x12' },
    { label: 'Cool-down', duration: '7 min', description: 'Stretching' },
  ],
  rationale: 'Monday is your highest readiness day. Placing a hard upper body session here maximizes performance.',
};

const newStrengthFriday: TrainingSession = {
  id: 'proposed-new-strength-fri',
  title: 'Lower Body Strength',
  type: 'strength',
  source: 'amakaflow',
  duration: 55,
  intensity: 'hard',
  status: 'planned',
  locked: false,
  steps: [
    { label: 'Warm-up', duration: '10 min', description: 'Hip openers, glute activation' },
    { label: 'Block A', duration: '25 min', description: 'Back Squats 5x5, Bulgarian Split Squats 3x10' },
    { label: 'Block B', duration: '15 min', description: 'RDLs 4x8, Calf Raises 3x15' },
    { label: 'Cool-down', duration: '5 min', description: 'Foam rolling' },
  ],
  rationale: 'Friday provides 48h gap since your last hard session. Lower body work here fits your 2x/week strength goal.',
};

export const mockProposedSessions: ProposedSession[] = [
  {
    id: 'proposal-1',
    session: newStrengthMonday,
    kind: 'new',
    rationale: 'Monday is your highest readiness day. Placing a hard upper body session here maximizes performance.',
    toDayIndex: 0, // Monday
  },
  {
    id: 'proposal-2',
    session: newStrengthFriday,
    kind: 'new',
    rationale: 'Friday provides 48h gap since your last hard session. Lower body work here fits your 2x/week strength goal.',
    toDayIndex: 4, // Friday
  },
  {
    id: 'proposal-3',
    session: { ...wednesdayStrength, hasConflict: false },
    kind: 'moved',
    rationale: 'Moving Full Body Strength from Wednesday to Friday avoids back-to-back hard days with Tuesday tempo run.',
    fromDayIndex: 2, // Wednesday
    toDayIndex: 4, // Friday
  },
];

export const mockPlanSummary: PlanSummaryData = {
  added: 2,
  moved: 1,
  removed: 0,
  totalWeeklyVolume: '6h 30min',
  hardDaysUsed: 3,
  hardDaysCap: 4,
  warnings: [
    'Approaching hard-day cap: 3 of 4 hard sessions this week. Adding more may increase injury risk.',
  ],
};

export function getMockPlanPreview(): PlanPreviewState {
  return {
    active: true,
    proposals: mockProposedSessions,
    summary: mockPlanSummary,
  };
}


// --- AMA-1118: Mock scheduling conflicts ---

function formatDate(dayOffset: number): string {
  const d = makeDate(dayOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const mockSchedulingConflicts: SchedulingConflict[] = [
  {
    type: 'same_muscle_group',
    severity: 'warning',
    message:
      'Two hard strength sessions on Tuesday and Wednesday are less than 48h apart. Same muscle groups may not have time to recover.',
    affectedSessionIds: ['tue-run-1', 'wed-strength-1'],
    affectedDates: [formatDate(1), formatDate(2)],
    suggestedFixes: [
      {
        label: 'Move to Thursday',
        action: 'move',
        sessionId: 'wed-strength-1',
        targetDate: formatDate(3),
      },
      {
        label: 'Downgrade to easy',
        action: 'downgrade',
        sessionId: 'wed-strength-1',
        targetIntensity: 'easy',
      },
      { label: 'Keep as is', action: 'keep' },
    ],
  },
  {
    type: 'pre_fatigue',
    severity: 'critical',
    message:
      'Hard strength on Wednesday is within 48h of your A-priority Long Run on Saturday. This may cause pre-fatigue and hurt race performance.',
    affectedSessionIds: ['wed-strength-1'],
    affectedDates: [formatDate(2), formatDate(5)],
    suggestedFixes: [
      {
        label: 'Move to Monday',
        action: 'move',
        sessionId: 'wed-strength-1',
        targetDate: formatDate(0),
      },
      {
        label: 'Downgrade to easy',
        action: 'downgrade',
        sessionId: 'wed-strength-1',
        targetIntensity: 'easy',
      },
      { label: 'Keep as is', action: 'keep' },
    ],
  },
  {
    type: 'overload',
    severity: 'warning',
    message:
      'Weekly volume is 350 min, which exceeds your 280 min target by 25%. This may lead to overtraining.',
    affectedSessionIds: [],
    affectedDates: [formatDate(0), formatDate(1), formatDate(2), formatDate(3), formatDate(5)],
    suggestedFixes: [
      { label: 'Remove lowest-priority session', action: 'keep' },
      { label: 'Keep as is', action: 'keep' },
    ],
  },
];
