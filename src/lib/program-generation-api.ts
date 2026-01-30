import { authenticatedApiCall } from './authenticated-fetch';
import {
  ProgramGenerationRequest,
  ProgramGenerationResponse,
  ProgramGenerationStatusResponse,
} from '@/types/program-wizard';

const API_BASE_URL = import.meta.env.VITE_PROGRAM_API_URL || 'http://localhost:8000';

export class ProgramGenerationApiClient {
  /**
   * Start program generation
   */
  async generateProgram(request: ProgramGenerationRequest): Promise<ProgramGenerationResponse> {
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
    return authenticatedApiCall<ProgramGenerationStatusResponse>(
      `${API_BASE_URL}/programs/generate/${jobId}/status`
    );
  }
}

// Singleton instance
export const programGenerationApi = new ProgramGenerationApiClient();
