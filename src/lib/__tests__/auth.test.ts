import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      getUser: vi.fn(),
      signInWithOAuth: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(),
  },
}));

import { signUp, signIn, signOut, getSession, getCurrentUser } from '../auth';
import { supabase } from '../supabase';
const mockSupabase = supabase as any;

describe('auth', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('signUp', () => {
    it('returns user and session on success', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: { id: 'u1', email: 'test@example.com' }, session: { access_token: 'token' } },
        error: null,
      });

      const result = await signUp({ email: 'test@example.com', password: 'pw' });
      expect(result.user).not.toBeNull();
      expect(result.error).toBeNull();
    });

    it('returns error on failure', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid email' },
      });

      const result = await signUp({ email: 'bad', password: 'pw' });
      expect(result.user).toBeNull();
      expect(result.error).toEqual({ message: 'Invalid email' });
    });
  });

  describe('signIn', () => {
    it('returns user on success', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'u1' }, session: {} },
        error: null,
      });

      const result = await signIn({ email: 'test@example.com', password: 'pw' });
      expect(result.user).not.toBeNull();
    });

    it('returns error on failure', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' },
      });

      const result = await signIn({ email: 'test', password: 'wrong' });
      expect(result.error).toBeDefined();
    });
  });

  describe('signOut', () => {
    it('calls supabase signOut', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });
      const result = await signOut();
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
      expect(result.error).toBeNull();
    });
  });

  describe('getSession', () => {
    it('returns session data', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
        error: null,
      });
      const result = await getSession();
      expect(result.session).toBeDefined();
    });
  });

  describe('getCurrentUser', () => {
    it('returns user data', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'u1', email: 'test@example.com' } },
        error: null,
      });
      const result = await getCurrentUser();
      expect(result.user).toBeDefined();
    });
  });
});
