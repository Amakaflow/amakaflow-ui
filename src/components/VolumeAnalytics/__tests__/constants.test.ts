/**
 * Tests for VolumeAnalytics constants and utility functions.
 *
 * Part of AMA-483: Volume Analytics Dashboard
 */

import { describe, it, expect } from 'vitest';
import {
  PUSH_MUSCLES,
  PULL_MUSCLES,
  UPPER_MUSCLES,
  LOWER_MUSCLES,
  getMuscleGroupDisplayName,
  getMuscleGroupColor,
  formatVolume,
  isPushMuscle,
  isPullMuscle,
  isUpperMuscle,
  isLowerMuscle,
} from '../constants';

// =============================================================================
// Muscle Group Arrays Tests
// =============================================================================

describe('Muscle group arrays', () => {
  it('PUSH_MUSCLES contains expected muscles', () => {
    expect(PUSH_MUSCLES).toContain('chest');
    expect(PUSH_MUSCLES).toContain('triceps');
  });

  it('PULL_MUSCLES contains expected muscles', () => {
    expect(PULL_MUSCLES).toContain('lats');
    expect(PULL_MUSCLES).toContain('biceps');
    expect(PULL_MUSCLES).toContain('rhomboids');
  });

  it('UPPER_MUSCLES contains expected muscles', () => {
    expect(UPPER_MUSCLES).toContain('chest');
    expect(UPPER_MUSCLES).toContain('lats');
    expect(UPPER_MUSCLES).toContain('shoulders');
    expect(UPPER_MUSCLES).toContain('biceps');
    expect(UPPER_MUSCLES).toContain('triceps');
  });

  it('LOWER_MUSCLES contains expected muscles', () => {
    expect(LOWER_MUSCLES).toContain('quadriceps');
    expect(LOWER_MUSCLES).toContain('hamstrings');
    expect(LOWER_MUSCLES).toContain('glutes');
    expect(LOWER_MUSCLES).toContain('calves');
  });

  it('push and pull muscles do not overlap', () => {
    const overlap = PUSH_MUSCLES.filter((m) => PULL_MUSCLES.includes(m));
    expect(overlap).toHaveLength(0);
  });

  it('upper and lower muscles do not overlap', () => {
    const overlap = UPPER_MUSCLES.filter((m) => LOWER_MUSCLES.includes(m));
    expect(overlap).toHaveLength(0);
  });
});

// =============================================================================
// getMuscleGroupDisplayName Tests
// =============================================================================

describe('getMuscleGroupDisplayName', () => {
  it('returns display name for known muscle groups', () => {
    expect(getMuscleGroupDisplayName('chest')).toBe('Chest');
    expect(getMuscleGroupDisplayName('lats')).toBe('Lats');
    expect(getMuscleGroupDisplayName('quadriceps')).toBe('Quads');
    expect(getMuscleGroupDisplayName('biceps')).toBe('Biceps');
  });

  it('handles aliases correctly', () => {
    expect(getMuscleGroupDisplayName('pectorals')).toBe('Chest');
    expect(getMuscleGroupDisplayName('latissimus_dorsi')).toBe('Lats');
    expect(getMuscleGroupDisplayName('quads')).toBe('Quads');
  });

  it('capitalizes unknown muscle groups', () => {
    expect(getMuscleGroupDisplayName('unknown_muscle')).toBe('Unknown muscle');
  });

  it('handles spaces in input', () => {
    expect(getMuscleGroupDisplayName('lower back')).toBe('Lower Back');
  });
});

// =============================================================================
// getMuscleGroupColor Tests
// =============================================================================

describe('getMuscleGroupColor', () => {
  it('returns color for known muscle groups', () => {
    expect(getMuscleGroupColor('chest')).toBe('#ef4444');
    expect(getMuscleGroupColor('lats')).toBe('#3b82f6');
    expect(getMuscleGroupColor('shoulders')).toBe('#f59e0b');
  });

  it('returns color for muscle group aliases', () => {
    // pectorals should map to chest color
    expect(getMuscleGroupColor('pectorals')).toBe('#ef4444');
    // latissimus_dorsi should map to lats color
    expect(getMuscleGroupColor('latissimus_dorsi')).toBe('#3b82f6');
  });

  it('returns default color for unknown muscle groups', () => {
    expect(getMuscleGroupColor('unknown_muscle')).toBe('#64748b');
  });
});

// =============================================================================
// isPushMuscle Tests
// =============================================================================

describe('isPushMuscle', () => {
  it('returns true for push muscles', () => {
    expect(isPushMuscle('chest')).toBe(true);
    expect(isPushMuscle('triceps')).toBe(true);
  });

  it('returns false for pull muscles', () => {
    expect(isPushMuscle('lats')).toBe(false);
    expect(isPushMuscle('biceps')).toBe(false);
  });

  it('handles case insensitivity', () => {
    expect(isPushMuscle('CHEST')).toBe(true);
    expect(isPushMuscle('Triceps')).toBe(true);
  });

  it('handles spaces', () => {
    expect(isPushMuscle('front delts')).toBe(true);
  });
});

// =============================================================================
// isPullMuscle Tests
// =============================================================================

describe('isPullMuscle', () => {
  it('returns true for pull muscles', () => {
    expect(isPullMuscle('lats')).toBe(true);
    expect(isPullMuscle('biceps')).toBe(true);
    expect(isPullMuscle('rhomboids')).toBe(true);
  });

  it('returns false for push muscles', () => {
    expect(isPullMuscle('chest')).toBe(false);
    expect(isPullMuscle('triceps')).toBe(false);
  });

  it('handles case insensitivity', () => {
    expect(isPullMuscle('LATS')).toBe(true);
    expect(isPullMuscle('Biceps')).toBe(true);
  });
});

// =============================================================================
// isUpperMuscle Tests
// =============================================================================

describe('isUpperMuscle', () => {
  it('returns true for upper body muscles', () => {
    expect(isUpperMuscle('chest')).toBe(true);
    expect(isUpperMuscle('lats')).toBe(true);
    expect(isUpperMuscle('shoulders')).toBe(true);
    expect(isUpperMuscle('biceps')).toBe(true);
    expect(isUpperMuscle('triceps')).toBe(true);
  });

  it('returns false for lower body muscles', () => {
    expect(isUpperMuscle('quadriceps')).toBe(false);
    expect(isUpperMuscle('hamstrings')).toBe(false);
    expect(isUpperMuscle('glutes')).toBe(false);
  });
});

// =============================================================================
// isLowerMuscle Tests
// =============================================================================

describe('isLowerMuscle', () => {
  it('returns true for lower body muscles', () => {
    expect(isLowerMuscle('quadriceps')).toBe(true);
    expect(isLowerMuscle('hamstrings')).toBe(true);
    expect(isLowerMuscle('glutes')).toBe(true);
    expect(isLowerMuscle('calves')).toBe(true);
  });

  it('returns false for upper body muscles', () => {
    expect(isLowerMuscle('chest')).toBe(false);
    expect(isLowerMuscle('lats')).toBe(false);
    expect(isLowerMuscle('shoulders')).toBe(false);
  });

  it('handles aliases', () => {
    expect(isLowerMuscle('quads')).toBe(true);
    expect(isLowerMuscle('gluteus')).toBe(true);
  });
});

// =============================================================================
// formatVolume Tests
// =============================================================================

describe('formatVolume', () => {
  it('formats small values without suffix', () => {
    expect(formatVolume(0)).toBe('0');
    expect(formatVolume(500)).toBe('500');
    expect(formatVolume(999)).toBe('999');
  });

  it('formats thousands with K suffix', () => {
    expect(formatVolume(1000)).toBe('1.0K');
    expect(formatVolume(5500)).toBe('5.5K');
    expect(formatVolume(10000)).toBe('10.0K');
    expect(formatVolume(999999)).toBe('1000.0K');
  });

  it('formats millions with M suffix', () => {
    expect(formatVolume(1000000)).toBe('1.0M');
    expect(formatVolume(2500000)).toBe('2.5M');
    expect(formatVolume(10000000)).toBe('10.0M');
  });
});
