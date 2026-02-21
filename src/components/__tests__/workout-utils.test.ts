import { describe, it, expect } from 'vitest';
import {
  getStructureDisplayName,
  formatRestSecs,
  formatMMSS,
  getBlockKeyMetric,
} from '../../lib/workout-utils';
import type { Block } from '../../types/workout';

describe('getStructureDisplayName', () => {
  it('returns WARM-UP for warmup', () => {
    expect(getStructureDisplayName('warmup')).toBe('WARM-UP');
  });
  it('returns COOLDOWN for cooldown', () => {
    expect(getStructureDisplayName('cooldown')).toBe('COOLDOWN');
  });
  it('returns FOR TIME for for-time', () => {
    expect(getStructureDisplayName('for-time')).toBe('FOR TIME');
  });
  it('returns CIRCUIT for circuit', () => {
    expect(getStructureDisplayName('circuit')).toBe('CIRCUIT');
  });
});

describe('formatRestSecs', () => {
  it('formats seconds <= 90 as Xs', () => {
    expect(formatRestSecs(30)).toBe('30s');
    expect(formatRestSecs(90)).toBe('90s');
  });
  it('formats seconds > 90 with minutes', () => {
    expect(formatRestSecs(120)).toBe('2m');
    expect(formatRestSecs(150)).toBe('2m 30s');
  });
});

describe('formatMMSS', () => {
  it('formats seconds as MM:SS', () => {
    expect(formatMMSS(600)).toBe('10:00');
    expect(formatMMSS(75)).toBe('1:15');
    expect(formatMMSS(1200)).toBe('20:00');
  });
});

describe('getBlockKeyMetric', () => {
  it('returns rounds and rest for circuit', () => {
    const block: Partial<Block> = {
      structure: 'circuit',
      rounds: 4,
      rest_between_rounds_sec: 30,
    };
    expect(getBlockKeyMetric(block as Block)).toBe('4 rnds · 30s rest');
  });
  it('returns time cap for amrap', () => {
    const block: Partial<Block> = {
      structure: 'amrap',
      time_cap_sec: 1200,
    };
    expect(getBlockKeyMetric(block as Block)).toBe('Cap: 20:00');
  });
  it('returns work/rest for tabata', () => {
    const block: Partial<Block> = {
      structure: 'tabata',
      time_work_sec: 20,
      time_rest_sec: 10,
      rounds: 8,
    };
    expect(getBlockKeyMetric(block as Block)).toBe('20s on · 10s off · 8 rnds');
  });
  it('returns Configure → when fields missing', () => {
    const block: Partial<Block> = { structure: 'circuit' };
    expect(getBlockKeyMetric(block as Block)).toBe('Configure →');
  });
  it('returns duration and activity for warmup', () => {
    const block: Partial<Block> = {
      structure: 'warmup',
      warmup_duration_sec: 300,
      warmup_activity: 'jump_rope',
    };
    expect(getBlockKeyMetric(block as Block)).toBe('5 min · jump rope');
  });
});
