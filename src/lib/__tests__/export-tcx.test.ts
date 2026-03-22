/**
 * AMA-120: Tests for client-side TCX export.
 */

import { describe, it, expect } from 'vitest';
import { generateTcxXml } from '../export-tcx';
import type { WorkoutStructure } from '../../types/workout';

function makeWorkout(overrides?: Partial<WorkoutStructure>): WorkoutStructure {
  return {
    title: 'Full Body Workout',
    source: 'manual',
    blocks: [
      {
        label: 'Main',
        structure: 'regular',
        exercises: [
          {
            id: 'ex-1',
            name: 'Bench Press',
            sets: 3,
            reps: 10,
            reps_range: null,
            duration_sec: null,
            rest_sec: 60,
            distance_m: null,
            distance_range: null,
            type: 'strength',
          },
          {
            id: 'ex-2',
            name: 'Squat',
            sets: 4,
            reps: 8,
            reps_range: null,
            duration_sec: null,
            rest_sec: 90,
            distance_m: null,
            distance_range: null,
            type: 'strength',
          },
        ],
      },
    ],
    ...overrides,
  };
}

const FIXED_START = '2026-03-22T10:00:00.000Z';

describe('AMA-120: TCX export', () => {
  it('generates valid XML with TrainingCenterDatabase root', () => {
    const xml = generateTcxXml(makeWorkout(), FIXED_START);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<TrainingCenterDatabase');
    expect(xml).toContain('</TrainingCenterDatabase>');
  });

  it('includes activity with correct sport type', () => {
    const xml = generateTcxXml(makeWorkout(), FIXED_START);
    expect(xml).toContain('Sport="Other"');
  });

  it('uses Running sport for running workouts', () => {
    const xml = generateTcxXml(makeWorkout({ workout_type: 'running' }), FIXED_START);
    expect(xml).toContain('Sport="Running"');
  });

  it('includes workout title in Notes', () => {
    const xml = generateTcxXml(makeWorkout(), FIXED_START);
    expect(xml).toContain('<Notes>Full Body Workout</Notes>');
  });

  it('includes activity ID as start time', () => {
    const xml = generateTcxXml(makeWorkout(), FIXED_START);
    expect(xml).toContain(`<Id>${FIXED_START}</Id>`);
  });

  it('generates laps for each block', () => {
    const xml = generateTcxXml(makeWorkout(), FIXED_START);
    expect(xml).toContain('<Lap StartTime=');
    expect(xml).toContain('<TotalTimeSeconds>');
  });

  it('includes block label in lap notes', () => {
    const xml = generateTcxXml(makeWorkout(), FIXED_START);
    expect(xml).toContain('<Notes>Main</Notes>');
  });

  it('generates trackpoints', () => {
    const xml = generateTcxXml(makeWorkout(), FIXED_START);
    expect(xml).toContain('<Track>');
    expect(xml).toContain('<Trackpoint>');
    expect(xml).toContain('<Time>');
  });

  it('includes AmakaFlow as creator', () => {
    const xml = generateTcxXml(makeWorkout(), FIXED_START);
    expect(xml).toContain('<Name>AmakaFlow</Name>');
  });

  it('handles empty workout', () => {
    const xml = generateTcxXml(makeWorkout({ blocks: [] }), FIXED_START);
    expect(xml).toContain('<TrainingCenterDatabase');
    expect(xml).toContain('<Activity');
    // No laps
    expect(xml).not.toContain('<Lap');
  });

  it('handles timed exercises', () => {
    const xml = generateTcxXml(makeWorkout({
      blocks: [{
        label: 'Cardio',
        structure: 'regular',
        exercises: [{
          id: 'ex-1',
          name: 'Treadmill',
          sets: null,
          reps: null,
          reps_range: null,
          duration_sec: 600,
          rest_sec: null,
          distance_m: null,
          distance_range: null,
          type: 'cardio',
        }],
      }],
    }), FIXED_START);
    expect(xml).toContain('<TotalTimeSeconds>600</TotalTimeSeconds>');
  });

  it('handles rounds correctly', () => {
    const xml = generateTcxXml(makeWorkout({
      blocks: [{
        label: 'Circuit',
        structure: 'circuit',
        rounds: 3,
        rest_between_rounds_sec: 60,
        exercises: [{
          id: 'ex-1',
          name: 'Burpees',
          sets: null,
          reps: 10,
          reps_range: null,
          duration_sec: null,
          rest_sec: null,
          distance_m: null,
          distance_range: null,
          type: 'cardio',
        }],
      }],
    }), FIXED_START);
    // 3 rounds * 30s (10 reps * 3s) + 2 * 60s rest = 210s
    expect(xml).toContain('<TotalTimeSeconds>210</TotalTimeSeconds>');
  });

  it('escapes XML special characters', () => {
    const xml = generateTcxXml(makeWorkout({ title: 'Push & Pull <Session>' }), FIXED_START);
    expect(xml).toContain('Push &amp; Pull &lt;Session&gt;');
  });

  it('includes superset exercises in lap', () => {
    const xml = generateTcxXml(makeWorkout({
      blocks: [{
        label: 'Arms',
        structure: 'superset',
        exercises: [],
        supersets: [{
          id: 'ss-1',
          exercises: [
            { id: 'ex-1', name: 'Curls', sets: 3, reps: 10, reps_range: null, duration_sec: null, rest_sec: null, distance_m: null, distance_range: null, type: 'strength' },
            { id: 'ex-2', name: 'Dips', sets: 3, reps: 10, reps_range: null, duration_sec: null, rest_sec: null, distance_m: null, distance_range: null, type: 'strength' },
          ],
        }],
      }],
    }), FIXED_START);
    // Should have trackpoints for both exercises
    const trackCount = (xml.match(/<Track>/g) || []).length;
    expect(trackCount).toBe(2);
  });
});
