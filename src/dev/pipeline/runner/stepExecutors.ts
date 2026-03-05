import { API_URLS } from '../../../lib/config';
import { WorkoutStructureSchema } from '../../../api/schemas/ingestor';
import { ValidationResponseSchema } from '../../../api/schemas/mapper';
import { validateAgainstSchema } from './schemaValidator';
import type { PipelineStep, ServiceName, SchemaValidationResult, InputType } from '../store/runTypes';

const TEST_USER_ID = 'observatory-test';

export interface ExecuteResult {
  request: PipelineStep['request'];
  response: PipelineStep['response'];
  schemaValidation?: SchemaValidationResult;
  apiOutput: unknown;
  error?: string;
}

export const INGEST_ENDPOINTS: Record<InputType, string> = {
  text: '/ingest/ai_workout',
  youtube: '/ingest/youtube',
  instagram: '/ingest/instagram_reel',
  tiktok: '/ingest/tiktok',
  url: '/ingest/url',
};

export async function executeIngest(input: string, inputType: InputType = 'text'): Promise<ExecuteResult> {
  const endpoint = INGEST_ENDPOINTS[inputType];
  const url = `${API_URLS.INGESTOR}${endpoint}`;
  
  // YouTube and TikTok can take 30-60s
  const timeoutMs = inputType === 'youtube' || inputType === 'tiktok' ? 60000 : 30000;
  
  const isTextInput = inputType === 'text';
  const headers = {
    'Content-Type': isTextInput ? 'text/plain' : 'application/json',
    'x-test-user-id': TEST_USER_ID,
  };
  const body = isTextInput ? input : JSON.stringify({ url: input });
  
  const request: PipelineStep['request'] = {
    url,
    method: 'POST',
    headers,
    body: isTextInput ? input : { url: input },
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const responseBody = await res.json();
    const schemaValidation = validateAgainstSchema(responseBody, WorkoutStructureSchema);
    return {
      request,
      response: { status: res.status, body: responseBody },
      schemaValidation,
      apiOutput: responseBody,
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
