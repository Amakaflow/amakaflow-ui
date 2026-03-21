/**
 * useWorkoutParser — API call + state management for AI workout parsing.
 *
 * AMA-1130: Calls POST /planning/parse-workout on the calendar-api
 * and manages loading, error, and result states.
 *
 * In demo mode, returns pre-parsed mock data without hitting the API.
 */

import { useState, useCallback } from 'react';
import { API_URLS } from '../../../lib/config';
import { authenticatedFetch } from '../../../lib/authenticated-fetch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedExercise {
  name: string;
  sets: number | null;
  reps: number | null;
  reps_range: string | null;
  duration_sec: number | null;
  rest_sec: number | null;
  distance_m: number | null;
  calories: number | null;
  type: 'strength' | 'cardio' | 'HIIT' | 'interval';
  notes: string | null;
  confidence: number;
}

export interface ParsedBlock {
  label: string;
  structure: string | null;
  rounds: number | null;
  time_cap_sec: number | null;
  time_work_sec: number | null;
  time_rest_sec: number | null;
  rest_between_rounds_sec: number | null;
  exercises: ParsedExercise[];
  confidence: number;
}

export interface AmbiguousPart {
  text: string;
  issue: string;
  suggestion: string;
}

export interface ParsedWorkout {
  title: string;
  workout_type: string;
  workout_type_confidence: number;
  estimated_duration_min: number | null;
  blocks: ParsedBlock[];
  ambiguous_parts: AmbiguousPart[];
  overall_confidence: number;
  raw_text: string;
}

export type ParserState = 'idle' | 'loading' | 'success' | 'error';

export interface UseWorkoutParserReturn {
  state: ParserState;
  result: ParsedWorkout | null;
  error: string | null;
  parseWorkout: (text: string, workoutTypeHint?: string) => Promise<void>;
  reset: () => void;
  updateExercise: (blockIdx: number, exIdx: number, updates: Partial<ParsedExercise>) => void;
  updateBlock: (blockIdx: number, updates: Partial<ParsedBlock>) => void;
  updateTitle: (title: string) => void;
}

// ---------------------------------------------------------------------------
// Mock data for demo mode
// ---------------------------------------------------------------------------

export const DEMO_WORKOUTS: Record<string, ParsedWorkout> = {
  interval: {
    title: 'Threshold Intervals',
    workout_type: 'cardio',
    workout_type_confidence: 0.95,
    estimated_duration_min: 45,
    blocks: [
      {
        label: 'Warm-up',
        structure: 'warmup',
        rounds: null,
        time_cap_sec: null,
        time_work_sec: null,
        time_rest_sec: null,
        rest_between_rounds_sec: null,
        exercises: [
          {
            name: 'Easy Jog',
            sets: null,
            reps: null,
            reps_range: null,
            duration_sec: 600,
            rest_sec: null,
            distance_m: null,
            calories: null,
            type: 'cardio',
            notes: 'Zone 2 effort',
            confidence: 0.95,
          },
        ],
        confidence: 0.95,
      },
      {
        label: 'Main Set',
        structure: 'rounds',
        rounds: 5,
        time_cap_sec: null,
        time_work_sec: null,
        time_rest_sec: null,
        rest_between_rounds_sec: 120,
        exercises: [
          {
            name: 'Running',
            sets: 5,
            reps: null,
            reps_range: null,
            duration_sec: null,
            rest_sec: 120,
            distance_m: 1000,
            calories: null,
            type: 'cardio',
            notes: 'At threshold pace (~4:30/km)',
            confidence: 0.95,
          },
        ],
        confidence: 0.95,
      },
      {
        label: 'Cool-down',
        structure: 'cooldown',
        rounds: null,
        time_cap_sec: null,
        time_work_sec: null,
        time_rest_sec: null,
        rest_between_rounds_sec: null,
        exercises: [
          {
            name: 'Easy Jog',
            sets: null,
            reps: null,
            reps_range: null,
            duration_sec: 300,
            rest_sec: null,
            distance_m: null,
            calories: null,
            type: 'cardio',
            notes: 'Gradually slow down',
            confidence: 0.9,
          },
        ],
        confidence: 0.9,
      },
    ],
    ambiguous_parts: [],
    overall_confidence: 0.95,
    raw_text: '10 min easy jog warm-up\n5x1km at threshold (~4:30/km), 2 min jog recovery\n5 min cool-down jog',
  },
  strength: {
    title: 'Upper Body Push/Pull',
    workout_type: 'strength',
    workout_type_confidence: 0.98,
    estimated_duration_min: 55,
    blocks: [
      {
        label: 'Main Lifts',
        structure: 'regular',
        rounds: null,
        time_cap_sec: null,
        time_work_sec: null,
        time_rest_sec: null,
        rest_between_rounds_sec: null,
        exercises: [
          {
            name: 'Bench Press',
            sets: 4,
            reps: 8,
            reps_range: null,
            duration_sec: null,
            rest_sec: 90,
            distance_m: null,
            calories: null,
            type: 'strength',
            notes: 'RPE 8',
            confidence: 0.98,
          },
          {
            name: 'Barbell Row',
            sets: 4,
            reps: 8,
            reps_range: null,
            duration_sec: null,
            rest_sec: 90,
            distance_m: null,
            calories: null,
            type: 'strength',
            notes: 'RPE 8',
            confidence: 0.98,
          },
        ],
        confidence: 0.98,
      },
      {
        label: 'Accessories',
        structure: 'regular',
        rounds: null,
        time_cap_sec: null,
        time_work_sec: null,
        time_rest_sec: null,
        rest_between_rounds_sec: null,
        exercises: [
          {
            name: 'Dumbbell Lateral Raise',
            sets: 3,
            reps: 12,
            reps_range: null,
            duration_sec: null,
            rest_sec: 60,
            distance_m: null,
            calories: null,
            type: 'strength',
            notes: null,
            confidence: 0.95,
          },
          {
            name: 'Face Pulls',
            sets: 3,
            reps: 15,
            reps_range: null,
            duration_sec: null,
            rest_sec: 60,
            distance_m: null,
            calories: null,
            type: 'strength',
            notes: null,
            confidence: 0.95,
          },
          {
            name: 'Bicep Curls',
            sets: 3,
            reps: 12,
            reps_range: null,
            duration_sec: null,
            rest_sec: 60,
            distance_m: null,
            calories: null,
            type: 'strength',
            notes: null,
            confidence: 0.95,
          },
        ],
        confidence: 0.96,
      },
    ],
    ambiguous_parts: [],
    overall_confidence: 0.97,
    raw_text: 'Main Lifts:\n4x8 Bench Press @ RPE 8, 90s rest\n4x8 Barbell Row @ RPE 8, 90s rest\n\nAccessories:\n3x12 Lateral Raises, 60s rest\n3x15 Face Pulls, 60s rest\n3x12 Bicep Curls, 60s rest',
  },
  hyrox: {
    title: 'HYROX Training Session',
    workout_type: 'circuit',
    workout_type_confidence: 0.9,
    estimated_duration_min: 50,
    blocks: [
      {
        label: 'HYROX Circuit',
        structure: 'rounds',
        rounds: 4,
        time_cap_sec: null,
        time_work_sec: null,
        time_rest_sec: null,
        rest_between_rounds_sec: 90,
        exercises: [
          {
            name: 'Rowing',
            sets: null,
            reps: null,
            reps_range: null,
            duration_sec: null,
            rest_sec: null,
            distance_m: 500,
            calories: null,
            type: 'cardio',
            notes: null,
            confidence: 0.92,
          },
          {
            name: 'Farmers Carry',
            sets: null,
            reps: null,
            reps_range: null,
            duration_sec: null,
            rest_sec: null,
            distance_m: 50,
            calories: null,
            type: 'strength',
            notes: null,
            confidence: 0.85,
          },
          {
            name: 'Wall Balls',
            sets: null,
            reps: 20,
            reps_range: null,
            duration_sec: null,
            rest_sec: null,
            distance_m: null,
            calories: null,
            type: 'strength',
            notes: '9kg ball',
            confidence: 0.9,
          },
          {
            name: 'Sled Push',
            sets: null,
            reps: null,
            reps_range: null,
            duration_sec: null,
            rest_sec: null,
            distance_m: 50,
            calories: null,
            type: 'strength',
            notes: null,
            confidence: 0.88,
          },
        ],
        confidence: 0.88,
      },
    ],
    ambiguous_parts: [
      {
        text: 'farmers carry',
        issue: 'Weight not specified',
        suggestion: 'What weight for the farmers carry? (e.g., 24kg per hand)',
      },
      {
        text: 'sled push',
        issue: 'Load not specified',
        suggestion: 'What load for the sled push? (e.g., 100kg total)',
      },
    ],
    overall_confidence: 0.85,
    raw_text: '4 rounds, 90s rest between:\n- 500m row\n- 50m farmers carry\n- 20 wall balls (9kg)\n- 50m sled push',
  },
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWorkoutParser(demoMode = false): UseWorkoutParserReturn {
  const [state, setState] = useState<ParserState>('idle');
  const [result, setResult] = useState<ParsedWorkout | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseWorkout = useCallback(
    async (text: string, workoutTypeHint?: string) => {
      setState('loading');
      setError(null);
      setResult(null);

      // Demo mode: return mock data after a short delay
      if (demoMode) {
        await new Promise((r) => setTimeout(r, 1200));
        const lowerText = text.toLowerCase();
        let mock: ParsedWorkout;
        if (lowerText.includes('hyrox') || lowerText.includes('circuit') || lowerText.includes('rounds')) {
          mock = { ...DEMO_WORKOUTS.hyrox, raw_text: text };
        } else if (lowerText.includes('km') || lowerText.includes('run') || lowerText.includes('jog') || lowerText.includes('threshold')) {
          mock = { ...DEMO_WORKOUTS.interval, raw_text: text };
        } else {
          mock = { ...DEMO_WORKOUTS.strength, raw_text: text };
        }
        setResult(mock);
        setState('success');
        return;
      }

      try {
        const resp = await authenticatedFetch(
          `${API_URLS.CALENDAR}/planning/parse-workout`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text,
              ...(workoutTypeHint ? { workout_type_hint: workoutTypeHint } : {}),
            }),
          },
        );

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ detail: 'Unknown error' }));
          throw new Error(err.detail || `Parse failed: ${resp.status}`);
        }

        const data: ParsedWorkout = await resp.json();
        setResult(data);
        setState('success');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setError(msg);
        setState('error');
      }
    },
    [demoMode],
  );

  const reset = useCallback(() => {
    setState('idle');
    setResult(null);
    setError(null);
  }, []);

  const updateExercise = useCallback(
    (blockIdx: number, exIdx: number, updates: Partial<ParsedExercise>) => {
      setResult((prev) => {
        if (!prev) return prev;
        const newBlocks = [...prev.blocks];
        const block = { ...newBlocks[blockIdx] };
        const exercises = [...block.exercises];
        exercises[exIdx] = { ...exercises[exIdx], ...updates };
        block.exercises = exercises;
        newBlocks[blockIdx] = block;
        return { ...prev, blocks: newBlocks };
      });
    },
    [],
  );

  const updateBlock = useCallback(
    (blockIdx: number, updates: Partial<ParsedBlock>) => {
      setResult((prev) => {
        if (!prev) return prev;
        const newBlocks = [...prev.blocks];
        newBlocks[blockIdx] = { ...newBlocks[blockIdx], ...updates };
        return { ...prev, blocks: newBlocks };
      });
    },
    [],
  );

  const updateTitle = useCallback((title: string) => {
    setResult((prev) => (prev ? { ...prev, title } : prev));
  }, []);

  return {
    state,
    result,
    error,
    parseWorkout,
    reset,
    updateExercise,
    updateBlock,
    updateTitle,
  };
}
