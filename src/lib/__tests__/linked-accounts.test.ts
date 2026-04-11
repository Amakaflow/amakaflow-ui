import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
  },
}));

import { getLinkedAccounts, saveLinkedAccounts, isAccountConnectedSync, getOAuthUrl } from '../linked-accounts';

describe('linked-accounts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getLinkedAccounts', () => {
    it('returns default accounts when no profile ID', async () => {
      const accounts = await getLinkedAccounts('');
      expect(accounts.strava.connected).toBe(false);
      expect(accounts.garmin.connected).toBe(false);
      expect(accounts.appleHealth.connected).toBe(false);
    });

    it('returns default accounts when no data in Supabase', async () => {
      const accounts = await getLinkedAccounts('user-1');
      expect(accounts.strava.connected).toBe(false);
    });
  });

  describe('saveLinkedAccounts', () => {
    it('saves to localStorage', () => {
      const accounts = {
        strava: { connected: true, connectedAt: '2026-04-10' },
        relive: { connected: false },
        trainingPeaks: { connected: false },
        appleHealth: { connected: false },
        garmin: { connected: false },
        amazfit: { connected: false },
      };
      saveLinkedAccounts(accounts as any);
      const stored = localStorage.getItem('amakaflow_linked_accounts');
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!).strava.connected).toBe(true);
    });
  });

  describe('isAccountConnectedSync', () => {
    it('returns false when no stored data', () => {
      expect(isAccountConnectedSync('strava')).toBe(false);
    });

    it('returns true when account is connected in localStorage', () => {
      const accounts = {
        strava: { connected: true, connectedAt: '2026-04-10T00:00:00Z' },
        relive: { connected: false },
        trainingPeaks: { connected: false },
        appleHealth: { connected: false },
        garmin: { connected: false },
        amazfit: { connected: false },
      };
      localStorage.setItem('amakaflow_linked_accounts', JSON.stringify(accounts));
      expect(isAccountConnectedSync('strava')).toBe(true);
      expect(isAccountConnectedSync('garmin')).toBe(false);
    });
  });

  describe('getOAuthUrl', () => {
    it('returns a URL string for strava', () => {
      const url = getOAuthUrl('strava');
      expect(typeof url).toBe('string');
      expect(url).toContain('strava');
    });
  });
});
