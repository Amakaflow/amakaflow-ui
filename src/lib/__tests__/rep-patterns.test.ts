/**
 * AMA-182: Tests for ladder/pyramid rep pattern utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  generateRepSequence,
  formatRepSequence,
  getPatternPreview,
  REP_PATTERN_LABELS,
} from '../rep-patterns';

describe('AMA-182: Rep patterns', () => {
  describe('generateRepSequence', () => {
    it('generates standard pattern (same reps each set)', () => {
      expect(generateRepSequence(10, 4, 2, 'standard')).toEqual([10, 10, 10, 10]);
    });

    it('generates ascending pattern', () => {
      expect(generateRepSequence(8, 3, 2, 'ascending')).toEqual([8, 10, 12]);
    });

    it('generates descending pattern', () => {
      expect(generateRepSequence(8, 3, 2, 'descending')).toEqual([12, 10, 8]);
    });

    it('generates pyramid pattern (odd sets)', () => {
      expect(generateRepSequence(8, 5, 2, 'pyramid')).toEqual([8, 10, 12, 10, 8]);
    });

    it('generates pyramid pattern (even sets)', () => {
      expect(generateRepSequence(8, 4, 2, 'pyramid')).toEqual([8, 10, 10, 8]);
    });

    it('handles single set', () => {
      expect(generateRepSequence(10, 1, 2, 'ascending')).toEqual([10]);
      expect(generateRepSequence(10, 1, 2, 'descending')).toEqual([10]);
      expect(generateRepSequence(10, 1, 2, 'pyramid')).toEqual([10]);
    });

    it('handles zero sets', () => {
      expect(generateRepSequence(10, 0, 2, 'ascending')).toEqual([]);
    });

    it('handles zero reps', () => {
      expect(generateRepSequence(0, 3, 2, 'ascending')).toEqual([]);
    });

    it('uses custom step', () => {
      expect(generateRepSequence(5, 4, 5, 'ascending')).toEqual([5, 10, 15, 20]);
    });

    it('defaults to standard when no pattern specified', () => {
      expect(generateRepSequence(10, 3)).toEqual([10, 10, 10]);
    });

    it('ascending with step=1', () => {
      expect(generateRepSequence(8, 4, 1, 'ascending')).toEqual([8, 9, 10, 11]);
    });

    it('descending with step=1', () => {
      expect(generateRepSequence(8, 4, 1, 'descending')).toEqual([11, 10, 9, 8]);
    });
  });

  describe('formatRepSequence', () => {
    it('formats sequence as comma-separated string', () => {
      expect(formatRepSequence([8, 10, 12])).toBe('8, 10, 12');
    });

    it('handles single element', () => {
      expect(formatRepSequence([10])).toBe('10');
    });

    it('handles empty array', () => {
      expect(formatRepSequence([])).toBe('');
    });

    it('formats pyramid sequence', () => {
      expect(formatRepSequence([8, 10, 12, 10, 8])).toBe('8, 10, 12, 10, 8');
    });
  });

  describe('getPatternPreview', () => {
    it('shows standard pattern as reps x sets', () => {
      expect(getPatternPreview(10, 4, 'standard')).toBe('10 reps x 4 sets');
    });

    it('shows ascending pattern with arrows', () => {
      expect(getPatternPreview(8, 3, 'ascending')).toBe('8 -> 10 -> 12');
    });

    it('shows descending pattern with arrows', () => {
      expect(getPatternPreview(8, 3, 'descending')).toBe('12 -> 10 -> 8');
    });

    it('shows pyramid pattern with arrows', () => {
      expect(getPatternPreview(8, 5, 'pyramid')).toBe('8 -> 10 -> 12 -> 10 -> 8');
    });
  });

  describe('REP_PATTERN_LABELS', () => {
    it('has labels for all patterns', () => {
      expect(REP_PATTERN_LABELS.standard).toBe('Standard');
      expect(REP_PATTERN_LABELS.ascending).toBeDefined();
      expect(REP_PATTERN_LABELS.descending).toBeDefined();
      expect(REP_PATTERN_LABELS.pyramid).toBeDefined();
    });
  });
});
