import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../authenticated-fetch', () => ({ authenticatedFetch: vi.fn() }));
vi.mock('../demo-mode', () => ({ isDemoMode: false }));

import {
  getTrainingProgram,
  getTrainingPrograms,
  deleteTrainingProgram,
  checkTrainingProgramApiHealth,
} from '../training-program-api';
import { authenticatedFetch } from '../authenticated-fetch';

const mockFetch = vi.mocked(authenticatedFetch);

describe('training-program-api', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getTrainingProgram returns program on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true, json: () => Promise.resolve({ success: true, program: { id: 'prog-1', title: 'PPL' } }),
    } as any);
    const result = await getTrainingProgram('prog-1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('prog-1');
  });

  it('getTrainingProgram returns null when not found', async () => {
    mockFetch.mockResolvedValue({
      ok: true, json: () => Promise.resolve({ success: false, message: 'Not found' }),
    } as any);
    const result = await getTrainingProgram('missing');
    expect(result).toBeNull();
  });

  it('getTrainingPrograms returns list', async () => {
    mockFetch.mockResolvedValue({
      ok: true, json: () => Promise.resolve({ success: true, programs: [{ id: 'p1' }, { id: 'p2' }], count: 2 }),
    } as any);
    const result = await getTrainingPrograms();
    expect(result).toHaveLength(2);
  });

  it('deleteTrainingProgram sends DELETE', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) } as any);
    await deleteTrainingProgram('prog-1');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/training-programs/prog-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('checkTrainingProgramApiHealth returns true when healthy', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
    expect(await checkTrainingProgramApiHealth()).toBe(true);
    globalThis.fetch = origFetch;
  });

  it('checkTrainingProgramApiHealth returns false on error', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('down'));
    expect(await checkTrainingProgramApiHealth()).toBe(false);
    globalThis.fetch = origFetch;
  });
});
