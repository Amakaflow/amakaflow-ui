import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../authenticated-fetch', () => ({ authenticatedFetch: vi.fn() }));
vi.mock('../demo-mode', () => ({ isDemoMode: false }));

import { fetchWorkoutCompletions, fetchWorkoutCompletionById } from '../completions-api';
import { authenticatedFetch } from '../authenticated-fetch';

const mockFetch = vi.mocked(authenticatedFetch);

describe('completions-api', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('fetchWorkoutCompletions', () => {
    it('returns transformed completions', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          completions: [
            { id: 'c1', workout_name: 'Test', started_at: '2026-04-10', duration_seconds: 3600, avg_heart_rate: 140, max_heart_rate: 170, min_heart_rate: 100, active_calories: 400, total_calories: 500, source: 'apple_watch' },
          ],
          total: 1,
        }),
      } as any);

      const result = await fetchWorkoutCompletions(10, 0);
      expect(result.completions).toHaveLength(1);
      expect(result.completions[0].workoutName).toBe('Test');
      expect(result.completions[0].avgHeartRate).toBe(140);
      expect(result.total).toBe(1);
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false, status: 500, statusText: 'Error',
        json: () => Promise.resolve({ detail: 'Server error' }),
      } as any);
      await expect(fetchWorkoutCompletions()).rejects.toThrow('Server error');
    });

    it('passes limit and offset as query params', async () => {
      mockFetch.mockResolvedValue({
        ok: true, json: () => Promise.resolve({ completions: [], total: 0 }),
      } as any);
      await fetchWorkoutCompletions(25, 50);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=25'),
        expect.any(Object),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=50'),
        expect.any(Object),
      );
    });
  });
});
