import { authenticatedApiCall } from './authenticated-fetch';
import { isDemoMode } from './demo-mode';
import {
  ProgramGenerationRequest,
  ProgramGenerationResponse,
  ProgramGenerationStatusResponse,
} from '@/types/program-wizard';

const API_BASE_URL = import.meta.env.VITE_PROGRAM_API_URL || 'http://localhost:8000';

// Demo: track poll count per job to simulate progress
const demoPollCounts: Record<string, number> = {};
const DEMO_PROGRAM_ID = 'demo-program-1'; // matches DEMO_PROGRAMS in demo-extended.ts

export class ProgramGenerationApiClient {
  /**
   * Start program generation
   */
  async generateProgram(request: ProgramGenerationRequest): Promise<ProgramGenerationResponse> {
    if (isDemoMode) {
      const jobId = `demo-job-${Date.now()}`;
      demoPollCounts[jobId] = 0;
      return { job_id: jobId, status: 'pending' };
    }
    return authenticatedApiCall<ProgramGenerationResponse>(
      `${API_BASE_URL}/programs/generate`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  }

  /**
   * Get generation job status
   */
  async getGenerationStatus(jobId: string): Promise<ProgramGenerationStatusResponse> {
    if (isDemoMode) {
      const count = (demoPollCounts[jobId] ?? 0) + 1;
      demoPollCounts[jobId] = count;
      if (count >= 3) {
        delete demoPollCounts[jobId];
        return { job_id: jobId, status: 'completed', progress: 100, program_id: DEMO_PROGRAM_ID };
      }
      return { job_id: jobId, status: 'processing', progress: Math.min(count * 33, 90) };
    }
    return authenticatedApiCall<ProgramGenerationStatusResponse>(
      `${API_BASE_URL}/programs/generate/${jobId}/status`
    );
  }
}

// Singleton instance
export const programGenerationApi = new ProgramGenerationApiClient();
