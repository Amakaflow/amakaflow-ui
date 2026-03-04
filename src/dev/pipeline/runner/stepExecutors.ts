import { API_URLS } from '../../../lib/config';
import { WorkoutStructureSchema } from '../../../api/schemas/ingestor';
import { ValidationResponseSchema } from '../../../api/schemas/mapper';
import { validateAgainstSchema } from './schemaValidator';
import type { PipelineStep, ServiceName, SchemaValidationResult } from '../store/runTypes';

const TEST_USER_ID = 'observatory-test';

export interface ExecuteResult {
  request: PipelineStep['request'];
  response: PipelineStep['response'];
  schemaValidation?: SchemaValidationResult;
  apiOutput: unknown;
  error?: string;
}

export async function executeIngest(workoutText: string): Promise<ExecuteResult> {
  const url = `${API_URLS.INGESTOR}/ingest/ai_workout`;
  const request: PipelineStep['request'] = {
    url,
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', 'x-test-user-id': TEST_USER_ID },
    body: workoutText,
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: request.headers,
      body: workoutText,
      signal: AbortSignal.timeout(30000),
    });
    const body = await res.json();
    const schemaValidation = validateAgainstSchema(body, WorkoutStructureSchema);
    return {
      request,
      response: { status: res.status, body },
      schemaValidation,
      apiOutput: body,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return { request, response: undefined, apiOutput: undefined, error: String(err) };
  }
}

export async function executeMap(exercises: string[]): Promise<ExecuteResult> {
  const url = `${API_URLS.MAPPER}/exercises/match`;
  const bodyPayload = { exercises };
  const request: PipelineStep['request'] = {
    url,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-user-id': TEST_USER_ID },
    body: bodyPayload,
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json();
    const schemaValidation = validateAgainstSchema(body, ValidationResponseSchema);
    return {
      request,
      response: { status: res.status, body },
      schemaValidation,
      apiOutput: body,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return { request, response: undefined, apiOutput: undefined, error: String(err) };
  }
}

export async function executeHealthCheck(_service: ServiceName, baseUrl: string): Promise<ExecuteResult> {
  const url = `${baseUrl}/health`;
  const request: PipelineStep['request'] = {
    url,
    method: 'GET',
    headers: {},
    body: undefined,
  };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const body = await res.json().catch(() => ({}));
    return {
      request,
      response: { status: res.status, body },
      apiOutput: body,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return { request, response: undefined, apiOutput: undefined, error: String(err) };
  }
}

export function extractExerciseNames(workoutStructure: unknown): string[] {
  if (!workoutStructure || typeof workoutStructure !== 'object') return [];
  const ws = workoutStructure as Record<string, unknown>;
  const blocks = Array.isArray(ws.blocks) ? ws.blocks : [];
  const names: string[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const exercises = Array.isArray((block as Record<string, unknown>).exercises)
      ? (block as Record<string, unknown>).exercises as unknown[]
      : [];
    for (const ex of exercises) {
      if (ex && typeof ex === 'object' && typeof (ex as Record<string, unknown>).name === 'string') {
        names.push((ex as Record<string, unknown>).name as string);
      }
    }
  }
  return names;
}
