import { describe, it, expect } from 'vitest';
import { formatDuration, formatDistance } from '../formatExercise';

describe('formatDuration', () => {
  it('formats seconds under 60', () => {
    expect(formatDuration(30)).toBe('30s');
    expect(formatDuration(0)).toBe('0s');
  });

  it('formats exact minutes', () => {
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(120)).toBe('2m');
  });

  it('formats minutes with remaining seconds', () => {
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(75)).toBe('1m 15s');
  });
});

describe('formatDistance', () => {
  it('formats meters under 1000', () => {
    expect(formatDistance(500)).toBe('500m');
    expect(formatDistance(100)).toBe('100m');
  });

  it('formats exact kilometers', () => {
    expect(formatDistance(1000)).toBe('1km');
    expect(formatDistance(5000)).toBe('5km');
  });

  it('formats fractional kilometers', () => {
    expect(formatDistance(1500)).toBe('1.5km');
    expect(formatDistance(2200)).toBe('2.2km');
  });
});
