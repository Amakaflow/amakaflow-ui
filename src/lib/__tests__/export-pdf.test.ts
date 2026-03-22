/**
 * AMA-119: Tests for client-side PDF export.
 */

import { describe, it, expect } from 'vitest';
import { generateWorkoutPdfHtml } from '../export-pdf';
import type { WorkoutStructure } from '../../types/workout';

function makeWorkout(overrides?: Partial<WorkoutStructure>): WorkoutStructure {
  return {
    title: 'Upper Body Blast',
    source: 'manual',
    blocks: [
      {
        label: 'Main Block',
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
            notes: 'Slow tempo',
          },
          {
            id: 'ex-2',
            name: 'Pull-ups',
            sets: 4,
            reps: null,
            reps_range: '8-12',
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

describe('AMA-119: PDF export', () => {
  describe('generateWorkoutPdfHtml', () => {
    it('returns valid HTML with doctype', () => {
      const html = generateWorkoutPdfHtml(makeWorkout());
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</html>');
    });

    it('includes workout title', () => {
      const html = generateWorkoutPdfHtml(makeWorkout());
      expect(html).toContain('Upper Body Blast');
    });

    it('includes custom date when provided', () => {
      const html = generateWorkoutPdfHtml(makeWorkout(), 'March 22, 2026');
      expect(html).toContain('March 22, 2026');
    });

    it('includes exercise names', () => {
      const html = generateWorkoutPdfHtml(makeWorkout());
      expect(html).toContain('Bench Press');
      expect(html).toContain('Pull-ups');
    });

    it('includes sets and reps', () => {
      const html = generateWorkoutPdfHtml(makeWorkout());
      // Sets column for bench press
      expect(html).toContain('>3<');
      // Reps column for bench press
      expect(html).toContain('>10<');
    });

    it('includes rest periods', () => {
      const html = generateWorkoutPdfHtml(makeWorkout());
      expect(html).toContain('60s');
      expect(html).toContain('90s');
    });

    it('includes exercise notes', () => {
      const html = generateWorkoutPdfHtml(makeWorkout());
      expect(html).toContain('Slow tempo');
    });

    it('includes block label with structure', () => {
      const html = generateWorkoutPdfHtml(makeWorkout());
      expect(html).toContain('Main Block');
      expect(html).toContain('(regular)');
    });

    it('handles blocks with rounds', () => {
      const html = generateWorkoutPdfHtml(makeWorkout({
        blocks: [{
          label: 'Circuit',
          structure: 'circuit',
          rounds: 3,
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
      }));
      expect(html).toContain('x3');
    });

    it('handles empty blocks', () => {
      const html = generateWorkoutPdfHtml(makeWorkout({ blocks: [] }));
      expect(html).toContain('Upper Body Blast');
      // Should still produce valid HTML
      expect(html).toContain('</html>');
    });

    it('includes source info', () => {
      const html = generateWorkoutPdfHtml(makeWorkout());
      expect(html).toContain('Source: manual');
    });

    it('escapes HTML characters in titles', () => {
      const html = generateWorkoutPdfHtml(makeWorkout({ title: 'Push & Pull <Day 1>' }));
      expect(html).toContain('Push &amp; Pull &lt;Day 1&gt;');
      expect(html).not.toContain('<Day 1>');
    });

    it('includes superset exercises', () => {
      const html = generateWorkoutPdfHtml(makeWorkout({
        blocks: [{
          label: 'Supersets',
          structure: 'superset',
          exercises: [],
          supersets: [{
            id: 'ss-1',
            exercises: [
              { id: 'ex-1', name: 'Bicep Curls', sets: 3, reps: 12, reps_range: null, duration_sec: null, rest_sec: null, distance_m: null, distance_range: null, type: 'strength' },
              { id: 'ex-2', name: 'Tricep Dips', sets: 3, reps: 12, reps_range: null, duration_sec: null, rest_sec: null, distance_m: null, distance_range: null, type: 'strength' },
            ],
          }],
        }],
      }));
      expect(html).toContain('Bicep Curls');
      expect(html).toContain('Tricep Dips');
    });

    it('includes AmakaFlow branding footer', () => {
      const html = generateWorkoutPdfHtml(makeWorkout());
      expect(html).toContain('Generated by AmakaFlow');
    });
  });
});
