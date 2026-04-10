import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock authenticated-fetch to bypass Clerk auth
vi.mock('../authenticated-fetch', () => ({
  authenticatedFetch: vi.fn(),
}));

import { getDeletionPreview, deleteAccountData, clearUserData } from '../account-api';
import { authenticatedFetch } from '../authenticated-fetch';

const mockFetch = vi.mocked(authenticatedFetch);

describe('account-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDeletionPreview', () => {
    it('returns deletion preview on success', async () => {
      const mockPreview = {
        workouts: 10, workout_completions: 5, programs: 2, tags: 8,
        follow_along_workouts: 3, paired_devices: 1, voice_settings: true,
        voice_corrections: 4, strava_connection: true, garmin_connection: false,
        total_items: 33, has_ios_devices: true, has_external_connections: true,
      };
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockPreview) } as any);

      const result = await getDeletionPreview();
      expect(result).toEqual(mockPreview);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/account/deletion-preview'));
    });

    it('throws on failed response', async () => {
      mockFetch.mockResolvedValue({ ok: false, statusText: 'Unauthorized' } as any);

      await expect(getDeletionPreview()).rejects.toThrow('Failed to fetch deletion preview');
    });
  });

  describe('deleteAccountData', () => {
    it('returns deletion result on success', async () => {
      const mockResult = { success: true, deleted: { workouts: 10, programs: 2 } };
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockResult) } as any);

      const result = await deleteAccountData();
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/account'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('throws with error detail on failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Server Error',
        json: () => Promise.resolve({ detail: 'User not found' }),
      } as any);

      await expect(deleteAccountData()).rejects.toThrow('User not found');
    });
  });

  describe('clearUserData', () => {
    it('calls reset endpoint with POST', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as any);

      const result = await clearUserData();
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/testing/reset-user-data'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
