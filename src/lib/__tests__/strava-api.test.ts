import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../authenticated-fetch', () => ({
  authenticatedFetch: vi.fn(),
}));

import {
  getStravaActivities,
  checkStravaApiHealth,
  StravaTokenExpiredError,
  StravaUnauthorizedError,
} from '../strava-api';
import { authenticatedFetch } from '../authenticated-fetch';

const mockFetch = vi.mocked(authenticatedFetch);

describe('strava-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStravaActivities', () => {
    it('returns activities on success', async () => {
      const mockActivities = [
        { id: 1, name: 'Morning Run', start_date: '2026-04-10', distance: 5000, elapsed_time: 1800, moving_time: 1700, type: 'Run' },
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockActivities),
      } as any);

      const result = await getStravaActivities();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Morning Run');
    });

    it('throws StravaTokenExpiredError on 401 with token message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ detail: 'No tokens found for user' }),
      } as any);

      await expect(getStravaActivities()).rejects.toThrow(StravaTokenExpiredError);
    });

    it('throws StravaUnauthorizedError on generic 401', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ detail: 'Not authorized' }),
      } as any);

      await expect(getStravaActivities()).rejects.toThrow(StravaUnauthorizedError);
    });
  });

  describe('checkStravaApiHealth', () => {
    it('returns true when API is healthy', async () => {
      mockFetch.mockResolvedValue({ ok: true } as any);
      const result = await checkStravaApiHealth();
      expect(result).toBe(true);
    });

    it('returns false when API is down', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const result = await checkStravaApiHealth();
      expect(result).toBe(false);
    });
  });

  describe('error classes', () => {
    it('StravaTokenExpiredError has correct name', () => {
      const err = new StravaTokenExpiredError();
      expect(err.name).toBe('StravaTokenExpiredError');
      expect(err.message).toContain('expired');
    });

    it('StravaUnauthorizedError has correct name', () => {
      const err = new StravaUnauthorizedError();
      expect(err.name).toBe('StravaUnauthorizedError');
      expect(err.message).toContain('authorization');
    });
  });
});
