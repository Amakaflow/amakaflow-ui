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

export type InputType = 'text' | 'youtube' | 'instagram' | 'tiktok' | 'url';

const INGEST_CONFIG: Record<InputType, {
  path: string;
  contentType: string;
  body: (input: string) => string;
}> = {
  text: {
    path: '/ingest/ai_workout',
    contentType: 'text/plain',
    body: (input: string) => input,
  },
  youtube: {
    path: '/ingest/youtube',
    contentType: 'application/json',
    body: (url: string) => JSON.stringify({ url }),
  },
  instagram: {
    path: '/ingest/instagram_reel',
    contentType: 'application/json',
    body: (url: string) => JSON.stringify({ url }),
  },
  tiktok: {
    path: '/ingest/tiktok',
    contentType: 'application/json',
    body: (url: string) => JSON.stringify({ url }),
  },
  url: {
    path: '/ingest/url',
    contentType: 'application/json',
    body: (url: string) => JSON.stringify({ url }),
  },
};

export async function executeIngest(
  input: string,
  inputType: InputType = 'text'
): Promise<ExecuteResult> {
  const config = INGEST_CONFIG[inputType];
  const url = `${API_URLS.INGESTOR}${config.path}`;
  const request: PipelineStep['request'] = {
    url,
    method: 'POST',
    headers: { 'Content-Type': config.contentType, 'x-test-user-id': TEST_USER_ID },
    body: config.body(input),
  };
  // Use longer timeout for video platforms (YouTube, TikTok)
  const timeout = inputType === 'youtube' || inputType === 'tiktok' ? 60000 : 30000;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: request.headers,
      body: config.body(input),
      signal: AbortSignal.timeout(timeout),
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
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { request, response: undefined, apiOutput: undefined, error: errorMessage };
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
