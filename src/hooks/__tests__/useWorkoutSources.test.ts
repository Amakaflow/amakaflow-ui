import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../../lib/demo-mode', () => ({ isDemoMode: false }));
vi.mock('../useCalendarApi', () => ({
  useConnectedCalendars: () => ({
    calendars: [],
    createCalendar: vi.fn(),
    deleteCalendar: vi.fn(),
    syncCalendar: vi.fn(),
  }),
}));

import { useWorkoutSources } from '../useWorkoutSources';

describe('useWorkoutSources (real mode, no connected calendars)', () => {
  it('returns 9 non-calendar sources', () => {
    const { result } = renderHook(() => useWorkoutSources({ userId: 'test' }));
    // 9 base sources (no calendar entries when no calendars connected)
    expect(result.current.sources.filter(s => s.category !== 'calendar')).toHaveLength(9);
  });

  it('every result has isConnected field', () => {
    const { result } = renderHook(() => useWorkoutSources({ userId: 'test' }));
    for (const s of result.current.sources) {
      expect(typeof s.isConnected).toBe('boolean');
    }
  });

  it('non-requiresConnection sources are always isConnected true', () => {
    const { result } = renderHook(() => useWorkoutSources({ userId: 'test' }));
    const alwaysOn = result.current.sources.filter(s => !s.requiresConnection);
    expect(alwaysOn.every(s => s.isConnected)).toBe(true);
  });

  it('returns no calendar entries when no calendars connected', () => {
    const { result } = renderHook(() => useWorkoutSources({ userId: 'test' }));
    expect(result.current.sources.filter(s => s.category === 'calendar')).toHaveLength(0);
  });

  it('ready is true when calendars array is available', () => {
    const { result } = renderHook(() => useWorkoutSources({ userId: 'test' }));
    expect(result.current.ready).toBe(true);
  });
});
