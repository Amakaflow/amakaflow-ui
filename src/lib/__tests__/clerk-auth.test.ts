import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@clerk/clerk-react', () => ({
  useUser: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { useClerkUser, useClerkAuth } from '../clerk-auth';

describe('useClerkUser', () => {
  it('returns mock values when Clerk is not configured', () => {
    const { result } = renderHook(() => useClerkUser());
    expect(result.current.user).toBeNull();
    expect(result.current.isLoaded).toBe(true);
    expect(result.current.isSignedIn).toBe(false);
  });
});

describe('useClerkAuth', () => {
  it('returns mock auth when Clerk is not configured', () => {
    const { result } = renderHook(() => useClerkAuth());
    expect(result.current.isSignedIn).toBe(false);
    expect(result.current.userId).toBeNull();
    expect(typeof result.current.signOut).toBe('function');
  });

  it('mock signOut resolves without error', async () => {
    const { result } = renderHook(() => useClerkAuth());
    await expect(result.current.signOut()).resolves.not.toThrow();
  });
});
