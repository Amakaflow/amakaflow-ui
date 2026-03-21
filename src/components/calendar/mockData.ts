import type { ConflictWarning, DayState, TrainingSession, WeekState } from './types';

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
