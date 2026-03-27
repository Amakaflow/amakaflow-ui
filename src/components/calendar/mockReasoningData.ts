/**
 * Mock reasoning data for AMA-1153 demo.
 *
 * Pre-generated reasoning for 3 different sessions showing varied
 * sources and confidence levels.
 */

import type { ReasoningData } from './ReasoningPanel';

/** Easy Recovery Run — moderate recovery, race approaching */
export const easyRunReasoning: ReasoningData = {
  session_id: 'thu-run-1',
  summary: 'Easy run because recovery is moderate and race in 3 weeks.',
  citations: [
    {
      source: 'garmin',
      metric: 'recovery_score',
      value: '62/100',
      interpretation: 'Moderate recovery — avoid hard sessions today.',
      confidence: 0.92,
      raw_data_url: 'https://connect.garmin.com/modern/daily-summary',
    },
    {
      source: 'strava',
      metric: 'training_load',
      value: '+12% this week',
      interpretation: 'Training load is climbing — easy effort keeps progression safe.',
      confidence: 0.85,
    },
    {
      source: 'calendar',
      metric: 'race_proximity',
      value: '21 days to goal race',
      interpretation: 'Entering taper window — volume should decrease.',
      confidence: 0.95,
    },
    {
      source: 'stryd',
      metric: 'power_trend',
      value: 'declining 2%',
      interpretation: 'Slight fatigue signal in running power — easy day supports recovery.',
      confidence: 0.78,
    },
  ],
  categories: {
    recovery: [
      {
        source: 'garmin',
        metric: 'recovery_score',
        value: '62/100',
        interpretation: 'Moderate recovery — avoid hard sessions today.',
        confidence: 0.92,
        raw_data_url: 'https://connect.garmin.com/modern/daily-summary',
      },
    ],
    load: [
      {
        source: 'strava',
        metric: 'training_load',
        value: '+12% this week',
        interpretation: 'Training load is climbing — easy effort keeps progression safe.',
        confidence: 0.85,
      },
    ],
    performance: [
      {
        source: 'stryd',
        metric: 'power_trend',
        value: 'declining 2%',
        interpretation: 'Slight fatigue signal in running power — easy day supports recovery.',
        confidence: 0.78,
      },
    ],
    schedule: [
      {
        source: 'calendar',
        metric: 'race_proximity',
        value: '21 days to goal race',
        interpretation: 'Entering taper window — volume should decrease.',
        confidence: 0.95,
      },
    ],
  },
  decision_factors: [
    'Moderate Garmin recovery score (62) signals avoid hard work',
    'Race in 3 weeks — taper phase beginning',
    'Training load already up 12% this week',
    'Stryd power trend slightly declining — fatigue accumulating',
  ],
};

/** Hard Strength — high readiness, gap since last hard session */
export const hardStrengthReasoning: ReasoningData = {
  session_id: 'wed-strength-1',
  summary: 'Hard strength placed here: 48h recovery gap and highest readiness day.',
  citations: [
    {
      source: 'garmin',
      metric: 'recovery_score',
      value: '88/100',
      interpretation: 'High recovery — ideal for a hard session.',
      confidence: 0.93,
    },
    {
      source: 'amakaflow',
      metric: 'session_gap',
      value: '48h since last hard session',
      interpretation: 'Sufficient recovery window between hard efforts.',
      confidence: 0.90,
    },
    {
      source: 'strava',
      metric: 'weekly_volume',
      value: '210 / 350 min target',
      interpretation: 'Room in weekly volume budget for a hard session.',
      confidence: 0.82,
    },
    {
      source: 'coach_memory',
      metric: 'strength_frequency',
      value: '1 of 2 target sessions this week',
      interpretation: 'Need another strength day to hit 2x/week goal.',
      confidence: 0.88,
    },
    {
      source: 'calendar',
      metric: 'time_availability',
      value: '60 min morning block',
      interpretation: 'Available time slot matches session duration.',
      confidence: 0.95,
    },
  ],
  categories: {
    recovery: [
      {
        source: 'garmin',
        metric: 'recovery_score',
        value: '88/100',
        interpretation: 'High recovery — ideal for a hard session.',
        confidence: 0.93,
      },
      {
        source: 'amakaflow',
        metric: 'session_gap',
        value: '48h since last hard session',
        interpretation: 'Sufficient recovery window between hard efforts.',
        confidence: 0.90,
      },
    ],
    load: [
      {
        source: 'strava',
        metric: 'weekly_volume',
        value: '210 / 350 min target',
        interpretation: 'Room in weekly volume budget for a hard session.',
        confidence: 0.82,
      },
    ],
    performance: [
      {
        source: 'coach_memory',
        metric: 'strength_frequency',
        value: '1 of 2 target sessions this week',
        interpretation: 'Need another strength day to hit 2x/week goal.',
        confidence: 0.88,
      },
    ],
    schedule: [
      {
        source: 'calendar',
        metric: 'time_availability',
        value: '60 min morning block',
        interpretation: 'Available time slot matches session duration.',
        confidence: 0.95,
      },
    ],
  },
  decision_factors: [
    'Garmin recovery 88/100 — best day this week for hard effort',
    '48h gap since last hard session meets recovery policy',
    'Only 1 of 2 target strength sessions completed this week',
    '60-min availability matches session duration',
    'Weekly volume still 140 min under target',
  ],
};

/** Tempo Run — fresh from rest day, HRV balanced */
export const tempoRunReasoning: ReasoningData = {
  session_id: 'tue-run-1',
  summary: 'Tempo run after rest day for optimal freshness, with Saturday long run 3 days away.',
  citations: [
    {
      source: 'garmin',
      metric: 'hrv_status',
      value: 'balanced (65ms)',
      interpretation: 'HRV is in balanced range — body ready for moderate stress.',
      confidence: 0.88,
      raw_data_url: 'https://connect.garmin.com/modern/daily-summary',
    },
    {
      source: 'stryd',
      metric: 'critical_power',
      value: '268W (stable)',
      interpretation: 'CP stable — fitness is maintained, tempo supports progression.',
      confidence: 0.91,
    },
    {
      source: 'strava',
      metric: 'acute_chronic_ratio',
      value: '1.05',
      interpretation: 'ACR in sweet spot (0.8-1.3) — safe to add moderate stress.',
      confidence: 0.84,
    },
    {
      source: 'calendar',
      metric: 'next_hard_session',
      value: 'Saturday long run (3 days away)',
      interpretation: 'Enough recovery between tempo and long run.',
      confidence: 0.93,
    },
    {
      source: 'amakaflow',
      metric: 'yesterday_activity',
      value: 'Rest day',
      interpretation: 'Coming off rest — primed for quality session.',
      confidence: 0.95,
    },
  ],
  categories: {
    recovery: [
      {
        source: 'garmin',
        metric: 'hrv_status',
        value: 'balanced (65ms)',
        interpretation: 'HRV is in balanced range — body ready for moderate stress.',
        confidence: 0.88,
        raw_data_url: 'https://connect.garmin.com/modern/daily-summary',
      },
      {
        source: 'amakaflow',
        metric: 'yesterday_activity',
        value: 'Rest day',
        interpretation: 'Coming off rest — primed for quality session.',
        confidence: 0.95,
      },
    ],
    load: [
      {
        source: 'strava',
        metric: 'acute_chronic_ratio',
        value: '1.05',
        interpretation: 'ACR in sweet spot (0.8-1.3) — safe to add moderate stress.',
        confidence: 0.84,
      },
    ],
    performance: [
      {
        source: 'stryd',
        metric: 'critical_power',
        value: '268W (stable)',
        interpretation: 'CP stable — fitness is maintained, tempo supports progression.',
        confidence: 0.91,
      },
    ],
    schedule: [
      {
        source: 'calendar',
        metric: 'next_hard_session',
        value: 'Saturday long run (3 days away)',
        interpretation: 'Enough recovery between tempo and long run.',
        confidence: 0.93,
      },
    ],
  },
  decision_factors: [
    'Rest day yesterday — primed for quality work',
    'HRV balanced at 65ms — body ready for moderate stress',
    '3-day gap before Saturday long run allows recovery',
    'ACR at 1.05 — in the progression sweet spot',
    'Stryd CP stable — tempo maintains fitness trajectory',
  ],
};

/** Map session IDs to reasoning data */
export const mockReasoningBySessionId: Record<string, ReasoningData> = {
  'thu-run-1': easyRunReasoning,
  'wed-strength-1': hardStrengthReasoning,
  'tue-run-1': tempoRunReasoning,
};
