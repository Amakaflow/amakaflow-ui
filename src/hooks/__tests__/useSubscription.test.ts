import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock Clerk's useAuth
vi.mock('@clerk/clerk-react', () => ({
  useAuth: vi.fn(),
}));

// Mock subscription lib
vi.mock('../../lib/subscription', () => ({
  getTierLimits: vi.fn((tier: string) => ({
    maxImports: tier === 'pro' ? 999 : 5,
    maxWorkouts: tier === 'pro' ? 999 : 10,
  })),
}));

import { useSubscription } from '../useSubscription';
import { useAuth } from '@clerk/clerk-react';

const mockUseAuth = vi.mocked(useAuth);

describe('useSubscription', () => {
  it('returns free tier when auth is not loaded', () => {
    mockUseAuth.mockReturnValue({ isLoaded: false, has: undefined } as any);

    const { result } = renderHook(() => useSubscription());
    expect(result.current.tier).toBe('free');
    expect(result.current.isPro).toBe(false);
  });

  it('returns free tier when user has no pro plan', () => {
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      has: vi.fn().mockReturnValue(false),
    } as any);

    const { result } = renderHook(() => useSubscription());
    expect(result.current.tier).toBe('free');
    expect(result.current.isPro).toBe(false);
  });

  it('returns pro tier when user has pro plan', () => {
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      has: vi.fn().mockImplementation(({ plan }: any) => plan === 'pro'),
    } as any);

    const { result } = renderHook(() => useSubscription());
    expect(result.current.tier).toBe('pro');
    expect(result.current.isPro).toBe(true);
  });

  it('returns limits based on tier', () => {
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      has: vi.fn().mockReturnValue(false),
    } as any);

    const { result } = renderHook(() => useSubscription());
    expect(result.current.limits.maxImports).toBe(5);
  });

  it('hasFeature returns false when not loaded', () => {
    mockUseAuth.mockReturnValue({ isLoaded: false, has: undefined } as any);

    const { result } = renderHook(() => useSubscription());
    expect(result.current.hasFeature('advanced_chat')).toBe(false);
  });

  it('hasFeature delegates to Clerk has()', () => {
    const hasMock = vi.fn().mockImplementation((arg: any) => {
      if (arg.feature === 'voice') return true;
      if (arg.plan) return false;
      return false;
    });
    mockUseAuth.mockReturnValue({ isLoaded: true, has: hasMock } as any);

    const { result } = renderHook(() => useSubscription());
    expect(result.current.hasFeature('voice')).toBe(true);
  });
});
