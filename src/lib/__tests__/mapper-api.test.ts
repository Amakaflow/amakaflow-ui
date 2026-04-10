import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../authenticated-fetch', () => ({ authenticatedFetch: vi.fn() }));

import {
  validateWorkoutMapping,
  autoMapWorkoutToGarmin,
  getExerciseSuggestions,
  checkMapperApiHealth,
} from '../mapper-api';
import { authenticatedFetch } from '../authenticated-fetch';

const mockFetch = vi.mocked(authenticatedFetch);

describe('mapper-api', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('validateWorkoutMapping', () => {
    it('sends workout for validation', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ valid: true, issues: [] }),
      } as any);
      const result = await validateWorkoutMapping({ title: 'Test', blocks: [] } as any);
      expect(result.valid).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/validate'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('autoMapWorkoutToGarmin', () => {
    it('sends workout for auto-mapping', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ mapped: true, exercises: [] }),
      } as any);
      const result = await autoMapWorkoutToGarmin({ title: 'Test', blocks: [] } as any);
      expect(result.mapped).toBe(true);
    });
  });

  describe('getExerciseSuggestions', () => {
    it('returns suggestions for query', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ name: 'Bench Press', category: 'chest' }]),
      } as any);
      const result = await getExerciseSuggestions('bench');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Bench Press');
    });
  });

  describe('checkMapperApiHealth', () => {
    it('returns true when healthy', async () => {
      mockFetch.mockResolvedValue({ ok: true } as any);
      expect(await checkMapperApiHealth()).toBe(true);
    });

    it('returns false on error', async () => {
      mockFetch.mockRejectedValue(new Error('down'));
      expect(await checkMapperApiHealth()).toBe(false);
    });
  });
});
