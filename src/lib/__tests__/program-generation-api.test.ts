import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../authenticated-fetch', () => ({ authenticatedApiCall: vi.fn() }));
vi.mock('../demo-mode', () => ({ isDemoMode: false }));

import { ProgramGenerationApiClient } from '../program-generation-api';
import { authenticatedApiCall } from '../authenticated-fetch';

const mockApiCall = vi.mocked(authenticatedApiCall);

describe('ProgramGenerationApiClient', () => {
  let client: ProgramGenerationApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ProgramGenerationApiClient();
  });

  describe('generateProgram', () => {
    it('sends POST to generate endpoint', async () => {
      mockApiCall.mockResolvedValue({ job_id: 'job-1', status: 'pending' });

      const result = await client.generateProgram({
        user_id: 'user-1',
        goal: 'strength',
        experience_level: 'intermediate',
        duration_weeks: 8,
        sessions_per_week: 4,
      } as any);

      expect(result.job_id).toBe('job-1');
      expect(result.status).toBe('pending');
      expect(mockApiCall).toHaveBeenCalledWith(
        expect.stringContaining('/programs/generate'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('getGenerationStatus', () => {
    it('fetches status for job ID', async () => {
      mockApiCall.mockResolvedValue({ job_id: 'job-1', status: 'completed', progress: 100, program_id: 'prog-1' });

      const result = await client.getGenerationStatus('job-1');
      expect(result.status).toBe('completed');
      expect(result.program_id).toBe('prog-1');
      expect(mockApiCall).toHaveBeenCalledWith(
        expect.stringContaining('/programs/generate/job-1/status'),
      );
    });
  });
});
