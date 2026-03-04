// src/api/pipelines/ingestion.ts

import { API_URLS } from '../../lib/config';
import { PipelineError } from './index';

export interface IngestionWorkout {
  title: string;
  blocks: Array<{
    label: string;
    structure: string | null;
    exercises: Array<{
      name: string;
      sets?: number;
      reps?: number;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface ValidationMatch {
  original_name: string;
  matched_name: string;
  confidence: number;
  garmin_id: string;
}

export interface IngestionValidation {
  success: boolean;
  matches: ValidationMatch[];
  unmapped: string[];
}

export interface IngestionResult {
  workout: IngestionWorkout;
  validation: IngestionValidation;
}

export interface IngestionSource {
  type: string;
  content: string;
}

/**
 * Runs the two-step ingestion pipeline:
 * 1. POST /ingest/ai_workout to the ingestor service to parse the workout
 * 2. POST /validate to the mapper service to validate exercise names
 *
 * Throws PipelineError('IngestorFailed') if the ingestor returns a non-OK response.
 * Throws PipelineError('UnmappedExercises') if any exercises cannot be mapped.
 */
export async function runIngestionPipeline(
  source: IngestionSource,
  signal?: AbortSignal,
): Promise<IngestionResult> {
  // Step 1: Ingest — send the source's content as the body
  let workout: IngestionWorkout;

  try {
    const ingestorResponse = await fetch(
      `${API_URLS.INGESTOR}/ingest/ai_workout`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: source.content,
        signal,
      },
    );

    if (!ingestorResponse.ok) {
      const detail = await ingestorResponse.json().catch(() => ({ detail: ingestorResponse.statusText }));
      throw new PipelineError('IngestorFailed', {
        message: detail.detail ?? `Ingestor returned ${ingestorResponse.status}`,
        status: ingestorResponse.status,
      });
    }

    workout = await ingestorResponse.json();
  } catch (err) {
    if (err instanceof PipelineError) throw err;
    throw new PipelineError('IngestorFailed', {
      message: err instanceof Error ? err.message : 'Ingestor request failed',
      cause: err,
    });
  }

  // Step 2: Extract all exercise names from the workout blocks
  const exerciseNames: string[] = [];
  for (const block of workout.blocks ?? []) {
    for (const exercise of block.exercises ?? []) {
      if (exercise.name) {
        exerciseNames.push(exercise.name);
      }
    }
  }

  // Step 3: Validate exercise names against the mapper service
  let validation: IngestionValidation;
  try {
    const mapperResponse = await fetch(`${API_URLS.MAPPER}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exercises: exerciseNames }),
      signal,
    });

    if (!mapperResponse.ok) {
      const errorData: { detail?: unknown } = await mapperResponse.json().catch(() => ({ detail: mapperResponse.statusText }));
      throw new PipelineError('MapperFailed', {
        message: String(errorData.detail ?? `Mapper returned ${mapperResponse.status}`),
        status: mapperResponse.status,
      });
    }

    validation = await mapperResponse.json();
  } catch (err) {
    if (err instanceof PipelineError) throw err;
    throw new PipelineError('MapperFailed', {
      message: err instanceof Error ? err.message : 'Mapper request failed',
      cause: err,
    });
  }

  // Step 4: Throw if any exercises could not be mapped
  if (validation.unmapped && validation.unmapped.length > 0) {
    throw new PipelineError('UnmappedExercises', {
      message: `${validation.unmapped.length} exercise(s) could not be mapped: ${validation.unmapped.join(', ')}`,
      unmapped: validation.unmapped,
    });
  }

  return { workout, validation };
}
