import { describe, it, expect } from 'vitest';
import { WORKOUT_TYPE_DEFAULTS } from '../workoutTypeDefaults';

describe('WORKOUT_TYPE_DEFAULTS', () => {
  it('has defaults for all workout types', () => {
    const expectedTypes = ['strength', 'circuit', 'hiit', 'cardio', 'running', 'yoga', 'follow_along', 'mixed'];
    for (const type of expectedTypes) {
      expect(WORKOUT_TYPE_DEFAULTS).toHaveProperty(type);
    }
  });

  it('strength has warmup and rest config', () => {
    const strength = WORKOUT_TYPE_DEFAULTS.strength;
    expect(strength.warmup).toBeDefined();
    expect(strength.warmup!.enabled).toBe(true);
    expect(strength.warmup!.duration).toBe(300);
    expect(strength.rest).toBeDefined();
    expect(strength.rest!.type).toBe('button');
  });

  it('circuit has timed rest', () => {
    const circuit = WORKOUT_TYPE_DEFAULTS.circuit;
    expect(circuit.rest!.type).toBe('timed');
    expect(circuit.rest!.duration).toBe(30);
  });

  it('yoga has no warmup', () => {
    const yoga = WORKOUT_TYPE_DEFAULTS.yoga;
    expect(yoga.warmup!.enabled).toBe(false);
  });

  it('follow_along has no warmup (video has built-in)', () => {
    const followAlong = WORKOUT_TYPE_DEFAULTS.follow_along;
    expect(followAlong.warmup!.enabled).toBe(false);
  });

  it('hiit has short rest intervals', () => {
    const hiit = WORKOUT_TYPE_DEFAULTS.hiit;
    expect(hiit.rest!.type).toBe('timed');
    expect(hiit.rest!.duration).toBeLessThan(30);
  });

  it('warmup durations are reasonable (0-600 seconds)', () => {
    for (const [, defaults] of Object.entries(WORKOUT_TYPE_DEFAULTS)) {
      if (defaults.warmup) {
        expect(defaults.warmup.duration).toBeGreaterThanOrEqual(0);
        expect(defaults.warmup.duration).toBeLessThanOrEqual(600);
      }
    }
  });
});
