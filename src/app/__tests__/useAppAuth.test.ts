import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies
vi.mock('../../lib/clerk-auth', () => ({
  useClerkUser: vi.fn(),
  syncClerkUserToProfile: vi.fn(),
  getUserProfileFromClerk: vi.fn(),
}));
vi.mock('../../lib/demo-mode', () => ({
  isDemoMode: false,
  DEMO_USER: { id: 'demo', email: 'demo@demo.com', name: 'Demo', subscription: 'free', workoutsThisWeek: 0, selectedDevices: [], mode: 'individual' },
}));
vi.mock('../../lib/linked-accounts', () => ({
  isAccountConnected: vi.fn().mockResolvedValue(false),
  isAccountConnectedSync: vi.fn().mockReturnValue(false),
}));
vi.mock('../../lib/workout-history', () => ({
  setCurrentProfileId: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import { useAppAuth } from '../useAppAuth';
import { useClerkUser, syncClerkUserToProfile } from '../../lib/clerk-auth';

const mockUseClerkUser = useClerkUser as ReturnType<typeof vi.fn>;
const mockSync = syncClerkUserToProfile as ReturnType<typeof vi.fn>;

describe('useAppAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates dev user when Clerk not configured', async () => {
    mockUseClerkUser.mockReturnValue({ user: null, isLoaded: true });
    // Simulate no Clerk key
    const origEnv = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
    (import.meta.env as any).VITE_CLERK_PUBLISHABLE_KEY = '';
    const { result } = renderHook(() => useAppAuth());
    await waitFor(() => expect(result.current.authLoading).toBe(false));
    expect(result.current.user?.id).toBe('dev-user');
    (import.meta.env as any).VITE_CLERK_PUBLISHABLE_KEY = origEnv;
  });

  it('syncs Clerk user to Supabase profile on load', async () => {
    const clerkUser = {
      id: 'clerk-123',
      primaryEmailAddress: { emailAddress: 'test@test.com' },
      emailAddresses: [{ emailAddress: 'test@test.com' }],
      firstName: 'Test',
      lastName: 'User',
      username: null,
      imageUrl: 'https://example.com/avatar.png',
    };
    (import.meta.env as any).VITE_CLERK_PUBLISHABLE_KEY = 'pk_test_abc';
    mockUseClerkUser.mockReturnValue({ user: clerkUser, isLoaded: true });
    mockSync.mockResolvedValue({
      id: 'profile-123',
      email: 'test@test.com',
      name: 'Test User',
      subscription: 'free',
      workoutsThisWeek: 0,
      selectedDevices: ['garmin'],
    });
    const { result } = renderHook(() => useAppAuth());
    await waitFor(() => expect(result.current.authLoading).toBe(false));
    expect(result.current.user?.id).toBe('profile-123');
    expect(result.current.user?.email).toBe('test@test.com');
  });

  it('returns null user when Clerk configured but no user signed in', async () => {
    (import.meta.env as any).VITE_CLERK_PUBLISHABLE_KEY = 'pk_test_abc';
    mockUseClerkUser.mockReturnValue({ user: null, isLoaded: true });
    const { result } = renderHook(() => useAppAuth());
    await waitFor(() => expect(result.current.authLoading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('needsProfileCompletion returns false when Clerk not configured', async () => {
    (import.meta.env as any).VITE_CLERK_PUBLISHABLE_KEY = '';
    mockUseClerkUser.mockReturnValue({ user: null, isLoaded: true });
    const { result } = renderHook(() => useAppAuth());
    await waitFor(() => expect(result.current.authLoading).toBe(false));
    // In dev mode (no Clerk), profile completion is skipped
    const devUser = result.current.user;
    expect(result.current.needsProfileCompletion(devUser)).toBe(false);
  });
});
