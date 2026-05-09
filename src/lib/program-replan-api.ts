/**
 * Program re-plan API client (AMA-1456).
 *
 * Streams partial program re-plan events from:
 *   POST /api/programs/replan/stream
 */

import { getAuthToken } from './authenticated-fetch';

const PROGRAM_API_BASE_URL = import.meta.env.VITE_PROGRAM_API_URL || 'http://localhost:8000';

export interface ReplanPreset {
  label: string;
  startWeekOffset: number | null; // null = use currentWeek from program
  weeksCount: number | null;       // null = replan to end of program
}

/** Preset quick-actions available in the re-plan UI. */
export const REPLAN_PRESETS: ReplanPreset[] = [
  { label: 'Re-plan remaining weeks', startWeekOffset: 0, weeksCount: null },
  { label: 'Re-plan next 4 weeks',    startWeekOffset: 0, weeksCount: 4 },
  { label: 'Re-plan last 4 weeks',    startWeekOffset: null, weeksCount: 4 },
];

export interface ReplanRequest {
  preview_id: string;
  start_week: number;
  end_week?: number;
}

export interface ReplanStageEvent {
  type: 'stage';
  stage: string;
  message: string;
  sub_progress?: { current: number; total: number };
}

export interface ReplanPreviewEvent {
  type: 'preview';
  preview_id: string;
  replanned_weeks: number[];
  program: Record<string, unknown>;
}

export interface ReplanErrorEvent {
  type: 'error';
  stage: string;
  message: string;
  recoverable: boolean;
}

export type ReplanEvent = ReplanStageEvent | ReplanPreviewEvent | ReplanErrorEvent;

export interface ReplanStreamCallbacks {
  onStage?: (event: ReplanStageEvent) => void;
  onPreview?: (event: ReplanPreviewEvent) => void;
  onError?: (event: ReplanErrorEvent) => void;
  onDone?: () => void;
}

/**
 * Stream a partial program re-plan via SSE.
 * Returns an AbortController so the caller can cancel the stream.
 */
export async function streamReplan(
  request: ReplanRequest,
  callbacks: ReplanStreamCallbacks,
): Promise<AbortController> {
  const controller = new AbortController();

  let response: Response;
  try {
    const token = await getAuthToken();
    response = await fetch(`${PROGRAM_API_BASE_URL}/api/programs/replan/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
  } catch (err) {
    callbacks.onError?.({
      type: 'error',
      stage: 'replanning',
      message: err instanceof Error ? err.message : 'Failed to start re-plan stream.',
      recoverable: true,
    });
    callbacks.onDone?.();
    return controller;
  }

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => response.statusText);
    callbacks.onError?.({
      type: 'error',
      stage: 'replanning',
      message: `Request failed: ${text}`,
      recoverable: false,
    });
    callbacks.onDone?.();
    return controller;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim();
            if (!raw) continue;
            try {
              const payload = JSON.parse(raw) as Record<string, unknown>;
              // Check error first so error payloads with a "stage" field don't
              // incorrectly trigger onStage.
              if (eventType === 'error' || payload['recoverable'] !== undefined) {
                callbacks.onError?.({
                  type: 'error',
                  stage: String(payload['stage'] ?? 'replanning'),
                  message: String(payload['message'] ?? 'Unknown error'),
                  recoverable: Boolean(payload['recoverable']),
                });
              } else if (eventType === 'preview' || payload['preview_id']) {
                callbacks.onPreview?.({
                  type: 'preview',
                  preview_id: String(payload['preview_id']),
                  replanned_weeks: (payload['replanned_weeks'] as number[]) ?? [],
                  program: (payload['program'] as Record<string, unknown>) ?? {},
                });
              } else if (eventType === 'stage' || payload['stage']) {
                callbacks.onStage?.({
                  type: 'stage',
                  stage: String(payload['stage'] ?? eventType),
                  message: String(payload['message'] ?? ''),
                  sub_progress: payload['sub_progress'] as ReplanStageEvent['sub_progress'],
                });
              }
            } catch {
              // Skip unparseable SSE lines
            }
            eventType = '';
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        callbacks.onError?.({
          type: 'error',
          stage: 'replanning',
          message: 'Stream connection lost. Please try again.',
          recoverable: true,
        });
      }
    } finally {
      callbacks.onDone?.();
    }
  })();

  return controller;
}
