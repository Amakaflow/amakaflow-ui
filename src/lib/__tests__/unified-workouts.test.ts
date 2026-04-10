import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDuration, getRelativeTime } from '../unified-workouts';

describe('formatDuration', () => {
  it('formats seconds under 60', () => {
    expect(formatDuration(30)).toBe('30s');
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(59)).toBe('59s');
  });

  it('formats minutes without remaining seconds', () => {
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(300)).toBe('5m');
    expect(formatDuration(3540)).toBe('59m');
  });

  it('formats minutes with remaining seconds', () => {
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(125)).toBe('2m 5s');
  });

  it('formats hours without remaining minutes', () => {
    expect(formatDuration(3600)).toBe('1h');
    expect(formatDuration(7200)).toBe('2h');
  });

  it('formats hours with remaining minutes', () => {
    expect(formatDuration(3660)).toBe('1h 1m');
    expect(formatDuration(5400)).toBe('1h 30m');
  });
});

describe('getRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for recent times', () => {
    expect(getRelativeTime('2026-04-10T11:59:30Z')).toBe('just now');
  });

  it('returns minutes ago', () => {
    expect(getRelativeTime('2026-04-10T11:55:00Z')).toBe('5m ago');
  });

  it('returns hours ago', () => {
    expect(getRelativeTime('2026-04-10T09:00:00Z')).toBe('3h ago');
  });

  it('returns yesterday', () => {
    expect(getRelativeTime('2026-04-09T12:00:00Z')).toBe('yesterday');
  });

  it('returns days ago', () => {
    expect(getRelativeTime('2026-04-07T12:00:00Z')).toBe('3d ago');
  });

  it('returns weeks ago', () => {
    expect(getRelativeTime('2026-03-27T12:00:00Z')).toBe('2w ago');
  });
});
