import { WorkoutStructure, SourceType, Block, Superset, Exercise, BulkWorkoutResponse } from '../types/workout';
import { authenticatedFetch } from './authenticated-fetch';
import { API_URLS } from './config';

// Use centralized API config
const API_BASE_URL = API_URLS.INGESTOR;

// API timeout in milliseconds (2 minutes for structure generation)
const API_TIMEOUT = 120000;

/**
 * Normalize workout structure to ensure all blocks have exercises array (new format)
 * Converts old format (supersets) to new format (exercises with structure)
 * This function is exported for use when loading workouts from history
 */
export function normalizeWorkoutStructure(workout: WorkoutStructure): WorkoutStructure {
  // DEBUG: Log incoming workout to trace warmup_sets persistence (AMA-94)
  console.log('[normalizeWorkoutStructure] Input workout exercises:',
    workout.blocks?.map(b => b.exercises?.map(e => ({
      name: e?.name,
      warmup_sets: e?.warmup_sets,
      warmup_reps: e?.warmup_reps
    }))));

  if (!workout.blocks || workout.blocks.length === 0) {
    return {
      ...workout,
      title: workout.title || 'Imported Workout',
      source: workout.source || 'unknown',
      blocks: [
        {
          label: 'Workout',
          structure: null,
          exercises: [],
        } as Block,
      ],
    };
  }

  const normalizedBlocks = workout.blocks.map((block: Block, index: number) => {
    const blockLabel = block.label || block.structure || `Block ${index + 1}`;

    let exercises: Exercise[] = block.exercises || [];
    let structure = block.structure;
    let restBetweenRoundsSec = block.rest_between_rounds_sec || block.rest_between_sec;

    if (block.supersets && block.supersets.length > 0) {
      exercises = [];
      block.supersets.forEach((superset) => {
        exercises.push(...superset.exercises);
      });

      if (!structure) {
        if (exercises.length === 2) {
          structure = 'superset';
        } else if (exercises.length > 2) {
          structure = 'circuit';
        }
      }

      if (block.supersets[0]?.rest_between_sec && !restBetweenRoundsSec) {
        restBetweenRoundsSec = block.supersets[0].rest_between_sec;
      }
    }

    const normalizedBlock: Block = {
      ...block, // Preserve all existing block properties (AMA-96: restOverride, AMA-93: warmup)
      label: blockLabel,
      structure: structure || null,
      exercises: exercises,
      rest_between_rounds_sec: restBetweenRoundsSec,
      rest_between_sets_sec: block.rest_between_sets_sec || null,
      time_work_sec: block.time_work_sec || null,
      time_rest_sec: block.time_rest_sec || null,
      time_cap_sec: block.time_cap_sec || null,
      rounds: block.rounds || null,
      sets: block.sets || null,
    };

    if (block.rest_between_sec !== undefined) {
      normalizedBlock.rest_between_sec = block.rest_between_sec;
    }

    return normalizedBlock;
  });

  return {
    ...workout,
    blocks: normalizedBlocks,
    title: workout.title || 'Imported Workout',
    source: workout.source || 'unknown',
    // AMA-213: Preserve workout type detection from API
    workout_type: workout.workout_type,
    workout_type_confidence: workout.workout_type_confidence,
  };
}

/**
 * Small post-processing pass for YouTube workouts:
 * - Only keep lines that look like real exercise names
 * - Drop obvious narration / promo lines ("did for rep one...", "$29.99", etc.)
 */
function sanitizeYoutubeWorkout(workout: WorkoutStructure): WorkoutStructure {
  if (!workout || !workout.blocks || workout.blocks.length === 0) {
    return workout;
  }

  const provenance: any = (workout as any)._provenance || {};
  const sourceUrl = (workout.source || provenance.source_url || '') as string;

  const isYoutube =
    sourceUrl.includes('youtube.com') ||
    sourceUrl.includes('youtu.be') ||
    !!provenance.youtube_strategy;

  if (!isYoutube) {
    return workout;
  }

  const EXERCISE_KEYWORDS = [
    'squat',
    'lunge',
    'press',
    'bench',
    'push-up',
    'pushup',
    'pull-up',
    'pullup',
    'row',
    'deadlift',
    'curl',
    'extension',
    'raise',
    'fly',
    'plank',
    'crunch',
    'situp',
    'sit-up',
    'burpee',
    'kettlebell',
    'dumbbell',
    'barbell',
    'hip thrust',
    'step up',
    'wall ball',
    'sled',
    'carry',
    'pulldown',
    'pull-down',
    'lat',
    'triceps',
    'biceps',
    'chest',
    'back',
    'shoulder',
    'deltoid',
    'core',
  ];

  const BANNED_SNIPPETS = [
    '$',
    'discount',
    'subscribe',
    'like and',
    'comment below',
    'link in the description',
    'as you can get it for',
  ];

  function looksLikeExerciseName(name: string | null | undefined): boolean {
    if (!name) return false;
    const trimmed = name.trim();
    if (trimmed.length < 5 || trimmed.length > 100) return false;

    const lower = trimmed.toLowerCase();

    if (BANNED_SNIPPETS.some((s) => lower.includes(s))) {
      return false;
    }

    const hasExerciseWord = EXERCISE_KEYWORDS.some((kw) => lower.includes(kw));
    if (!hasExerciseWord) {
      return false;
    }

    // Kill very chatty / sentence-like lines that clearly aren't labels
    if (lower.startsWith('did for rep one')) return false;
    if (lower.startsWith('by the time they get')) return false;

    return true;
  }

  const cleanedBlocks: Block[] = workout.blocks
    .map((block) => {
      const originalExercises = block.exercises || [];
      const cleanedExercises = originalExercises.filter((ex) =>
        looksLikeExerciseName(ex.name),
      );

      if (cleanedExercises.length === 0) {
        return null;
      }

      let structure = block.structure || null;
      if (!structure) {
        if (cleanedExercises.length === 2) {
          structure = 'superset';
        } else if (cleanedExercises.length > 2) {
          structure = 'circuit';
        }
      }

      return {
        ...block,
        structure,
        exercises: cleanedExercises,
      } as Block;
    })
    .filter((b): b is Block => !!b);

  if (!cleanedBlocks.length) {
    return workout;
  }

  return {
    ...workout,
    blocks: cleanedBlocks,
  };
}

/**
 * Real API client for workout-ingestor-api
 */

async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {},
  signal?: AbortSignal,
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {};

  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, value]) => {
        headers[key] = value;
      });
    } else {
      Object.assign(headers, options.headers);
    }
  }

  if (!(options.body instanceof FormData)) {
    const hasContentType = Object.keys(headers).some(
      (k) => k.toLowerCase() === 'content-type',
    );

    if (!hasContentType) {
      headers['Content-Type'] = 'application/json';
    }
  }

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), API_TIMEOUT);

  let finalSignal: AbortSignal;
  if (signal) {
    signal.addEventListener('abort', () => {
      timeoutController.abort();
    });
    finalSignal = signal;
  } else {
    finalSignal = timeoutController.signal;
  }

  try {
    const response = await authenticatedFetch(url, {
      ...options,
      headers,
      signal: finalSignal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: response.statusText,
      }));
      throw new Error(error.detail || `API error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(`Failed to parse response as JSON: ${text.substring(0, 100)}`);
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError' || error.name === 'AbortSignal') {
      if (signal?.aborted) {
        throw new Error('Generation cancelled');
      }
      throw new Error(
        `Request timeout: Structure generation took longer than ${
          API_TIMEOUT / 1000
        } seconds. The image may be complex or the server is slow. Please try again.`,
      );
    }
    throw error;
  }
}

/**
 * Generate workout structure from sources
 */
export async function generateWorkoutStructure(
  sources: Array<{ type: SourceType; content: string }>,
  signal?: AbortSignal,
): Promise<WorkoutStructure> {
  let workout: WorkoutStructure | undefined;

  for (const source of sources) {
    if (source.type === 'youtube') {
      const resp = await apiCall<WorkoutStructure>(
        '/ingest/youtube',
        {
          method: 'POST',
          body: JSON.stringify({ url: source.content }),
        },
        signal,
      );

      workout = sanitizeYoutubeWorkout(resp);
      break;
    }

    if (source.type === 'tiktok') {
      const resp = await apiCall<WorkoutStructure>(
        '/ingest/tiktok',
        {
          method: 'POST',
          // Use oembed mode - official TikTok API, no video download required
          // Falls back to thumbnail vision if text parsing fails
          body: JSON.stringify({ url: source.content, mode: 'oembed' }),
        },
        signal,
      );

      workout = resp;
      break;
    }

    if (source.type === 'pinterest') {
      // Pinterest can return either a single workout or bulk workouts
      const resp = await apiCall<WorkoutStructure | BulkWorkoutResponse>(
        '/ingest/pinterest',
        {
          method: 'POST',
          body: JSON.stringify({ url: source.content }),
        },
        signal,
      );

      // Check if this is a bulk response (multi-workout plan or board)
      if ('workouts' in resp && Array.isArray(resp.workouts) && resp.workouts.length > 0) {
        const bulkResp = resp as BulkWorkoutResponse;
        console.log(`[Pinterest] Bulk import detected: ${bulkResp.total} workouts`);

        // Return the first workout with all bulk workouts attached for selection
        const firstWorkout = bulkResp.workouts[0];
        workout = {
          ...firstWorkout,
          _bulkWorkouts: bulkResp.workouts,
          _provenance: {
            ...firstWorkout._provenance,
            ...bulkResp._provenance,
            bulk_import: true,
            total_workouts: bulkResp.total,
          },
        };
      } else {
        // Single workout response
        workout = resp as WorkoutStructure;
      }
      break;
    }

    if (source.type === 'image') {
      try {
        const imageResponse = await fetch(source.content);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image from URL: ${imageResponse.statusText}`);
        }

        const imageBlob = await imageResponse.blob();

        const formData = new FormData();
        let fileName = 'image.jpg';
        if (source.content.startsWith('blob:')) {
          const mimeType = imageBlob.type;
          const extension = mimeType.split('/')[1] || 'jpg';
          fileName = `image.${extension}`;
        } else {
          try {
            const urlPath = new URL(source.content).pathname;
            fileName = urlPath.split('/').pop() || 'image.jpg';
          } catch {
            const parts = source.content.split('/');
            fileName = parts[parts.length - 1] || 'image.jpg';
          }

          if (!fileName.includes('.')) {
            const mimeType = imageBlob.type;
            const extension = mimeType.split('/')[1] || 'jpg';
            fileName = `${fileName}.${extension}`;
          }
        }
        formData.append('file', imageBlob, fileName);

        const { getImageProcessingMethod } = await import('./preferences');
        const method = getImageProcessingMethod();

        let endpoint = '/ingest/image';
        const usedVisionAPI = method === 'vision';
        if (usedVisionAPI) {
          endpoint = '/ingest/image_vision';
          formData.append('vision_provider', 'openai');
          formData.append('vision_model', 'gpt-4o-mini');
        }

        workout = await apiCall<WorkoutStructure>(
          endpoint,
          {
            method: 'POST',
            body: formData,
            headers: {},
          },
          signal,
        );

        (workout as any)._usedVisionAPI = usedVisionAPI;
        break;
      } catch (error: any) {
        if (error.message.includes('Failed to fetch image')) {
          throw error;
        }
        throw new Error(`Error processing image: ${error.message}`);
      }
    }

    if (source.type === 'ai-text') {
      let normalizedContent = source.content
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .trim();

      const trimmedContent = normalizedContent;
      const isJson = trimmedContent.startsWith('{') || trimmedContent.startsWith('[');

      if (isJson) {
        try {
          const jsonData = JSON.parse(trimmedContent);
          workout = await apiCall<WorkoutStructure>(
            '/ingest/json',
            {
              method: 'POST',
              body: JSON.stringify(jsonData),
              headers: {
                'Content-Type': 'application/json',
              },
            },
            signal,
          );
        } catch (e) {
          workout = await apiCall<WorkoutStructure>(
            '/ingest/ai_workout',
            {
              method: 'POST',
              body: normalizedContent,
              headers: {
                'Content-Type': 'text/plain',
              },
            },
            signal,
          );
        }
      } else {
        workout = await apiCall<WorkoutStructure>(
          '/ingest/ai_workout',
          {
            method: 'POST',
            body: normalizedContent,
            headers: {
              'Content-Type': 'text/plain',
            },
          },
          signal,
        );
      }
      break;
    }
  }

  if (!workout) {
    throw new Error('Unsupported source type');
  }

  return normalizeWorkoutStructure(workout);
}

// Cache for health check to avoid repeated calls
let healthCheckCache: { result: boolean; timestamp: number } | null = null;
const HEALTH_CHECK_CACHE_DURATION = 5000;

/**
 * Create an empty workout structure via API
 */
export async function createEmptyWorkout(): Promise<WorkoutStructure> {
  try {
    const workout = await apiCall<WorkoutStructure>('/workouts/create-empty', {
      method: 'POST',
    });

    return normalizeWorkoutStructure(workout);
  } catch (error: any) {
    console.warn('Failed to create empty workout via API, using local fallback:', error);
    const { createEmptyWorkout: createEmptyWorkoutLocal } = await import('./workout-utils');
    return createEmptyWorkoutLocal();
  }
}

/**
 * Check if the API is available
 */
export async function checkApiHealth(): Promise<boolean> {
  if (healthCheckCache && Date.now() - healthCheckCache.timestamp < HEALTH_CHECK_CACHE_DURATION) {
    return healthCheckCache.result;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await authenticatedFetch(`${API_BASE_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const isHealthy = response.ok;
    healthCheckCache = {
      result: isHealthy,
      timestamp: Date.now(),
    };
    return isHealthy;
  } catch (error) {
    healthCheckCache = {
      result: false,
      timestamp: Date.now(),
    };
    return false;
  }
}