import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../authenticated-fetch', () => ({ authenticatedFetch: vi.fn() }));
vi.mock('../demo-mode', () => ({ isDemoMode: false }));

import { getWorkoutFromAPI, deleteWorkoutFromAPI, updateWorkoutExportStatus } from '../workout-api';
import { authenticatedFetch } from '../authenticated-fetch';

const mockFetch = vi.mocked(authenticatedFetch);

describe('workout-api', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getWorkoutFromAPI', () => {
    it('returns workout when found', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, workout: { id: 'w1', title: 'Found' } }),
      } as any);
      const result = await getWorkoutFromAPI('w1', 'p1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('w1');
    });

    it('returns null when not found', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: false, message: 'Not found' }),
      } as any);
      const result = await getWorkoutFromAPI('missing', 'p1');
      expect(result).toBeNull();
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false, status: 500, statusText: 'Server Error',
        json: () => Promise.resolve({ message: 'Internal error' }),
      } as any);
      await expect(getWorkoutFromAPI('w1', 'p1')).rejects.toThrow();
    });
  });

  describe('deleteWorkoutFromAPI', () => {
    it('returns true on success', async () => {
      mockFetch.mockResolvedValue({
        ok: true, json: () => Promise.resolve({ success: true }),
      } as any);
      const result = await deleteWorkoutFromAPI('w1', 'p1');
      expect(result).toBe(true);
    });

    it('returns false on failure', async () => {
      mockFetch.mockResolvedValue({
        ok: true, json: () => Promise.resolve({ success: false }),
      } as any);
      const result = await deleteWorkoutFromAPI('w1', 'p1');
      expect(result).toBe(false);
    });
  });

  describe('updateWorkoutExportStatus', () => {
    it('sends PUT with export status', async () => {
      mockFetch.mockResolvedValue({
        ok: true, json: () => Promise.resolve({ success: true, message: 'Updated' }),
      } as any);
      const result = await updateWorkoutExportStatus('w1', 'p1', true, 'garmin');
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/workouts/w1/export-status'),
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });
});
