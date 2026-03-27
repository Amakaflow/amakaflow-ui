/**
 * Tests for generateWorkoutStructure() in api.ts
 *
 * Verifies that the correct API endpoint is called for each source type,
 * with special attention to the new Instagram source type that calls
 * /ingest/instagram_reel.
 *
 * AMA-564: Instagram Apify auto-extraction.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateWorkoutStructure } from '../api';

// ---------------------------------------------------------------------------
// Mock authenticated-fetch globally
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();

vi.mock('../authenticated-fetch', () => ({
  authenticatedFetch: (...args: unknown[]) => mockFetch(...args),
}));

// Mock preferences to avoid localStorage errors
vi.mock('../preferences', () => ({
  getImageProcessingMethod: () => 'ocr',
  getInstagramAutoExtract: () => false,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockJsonResponse(data: object, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

const MOCK_WORKOUT_RESPONSE = {
  title: 'Test Workout',
  blocks: [
    {
      label: 'Main',
      structure: 'regular',
      exercises: [{ name: 'Squats', sets: 3, reps: 10, type: 'strength' }],
    },
  ],
};

const MOCK_INSTAGRAM_RESPONSE = {
  title: 'Instagram HIIT',
  workout_type: 'hiit',
  blocks: [
    {
      label: 'Circuit',
      structure: 'circuit',
      exercises: [{ name: 'Burpees', sets: 1, reps: 10, type: 'cardio' }],
    },
  ],
  _provenance: {
    mode: 'instagram_reel',
    source_url: 'https://www.instagram.com/reel/ABC123/',
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateWorkoutStructure', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call /ingest/instagram_reel for instagram source type', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse(MOCK_INSTAGRAM_RESPONSE));

    const result = await generateWorkoutStructure([
      { type: 'instagram', content: 'https://www.instagram.com/reel/ABC123/' },
    ]);

    // Verify the correct endpoint was called
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/ingest/instagram_reel');
    expect(options.method).toBe('POST');

    // Verify the request body contains the URL
    const body = JSON.parse(options.body);
    expect(body.url).toBe('https://www.instagram.com/reel/ABC123/');

    // Verify the result is normalized
    expect(result.title).toBe('Instagram HIIT');
    expect(result.blocks[0].exercises[0].name).toBe('Burpees');
  });

  it('should call /ingest/youtube for youtube source type', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse(MOCK_WORKOUT_RESPONSE));

    await generateWorkoutStructure([
      { type: 'youtube', content: 'https://www.youtube.com/watch?v=abc' },
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/ingest/youtube');
  });

  it('should call /ingest/tiktok for tiktok source type', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse(MOCK_WORKOUT_RESPONSE));

    await generateWorkoutStructure([
      { type: 'tiktok', content: 'https://www.tiktok.com/@user/video/123' },
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/ingest/tiktok');
  });

  it('should call /ingest/pinterest for pinterest source type', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse(MOCK_WORKOUT_RESPONSE));

    await generateWorkoutStructure([
      { type: 'pinterest', content: 'https://www.pinterest.com/pin/123' },
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/ingest/pinterest');
  });

  it('should process only the first source (break after match)', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse(MOCK_INSTAGRAM_RESPONSE));

    await generateWorkoutStructure([
      { type: 'instagram', content: 'https://www.instagram.com/reel/ABC123/' },
      { type: 'youtube', content: 'https://www.youtube.com/watch?v=def' },
    ]);

    // Only one fetch should be made (instagram), not two
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/ingest/instagram_reel');
  });

  it('should throw "Unsupported source type" when no sources match', async () => {
    await expect(
      generateWorkoutStructure([])
    ).rejects.toThrow('Unsupported source type');
  });

  it('should normalize the instagram response through normalizeWorkoutStructure', async () => {
    const responseWithSupersets = {
      title: 'Superset Workout',
      blocks: [
        {
          label: 'Supersets',
          structure: 'superset',
          exercises: [],
          supersets: [
            {
              exercises: [
                { name: 'Squats', sets: 5, reps: 5, type: 'strength' },
                { name: 'Box Jumps', sets: 5, reps: 5, type: 'plyometric' },
              ],
            },
          ],
        },
      ],
      _provenance: { mode: 'instagram_reel' },
    };

    mockFetch.mockResolvedValueOnce(mockJsonResponse(responseWithSupersets));

    const result = await generateWorkoutStructure([
      { type: 'instagram', content: 'https://www.instagram.com/reel/XYZ/' },
    ]);

    // normalizeWorkoutStructure should keep exercises empty and preserve supersets
    expect(result.blocks[0].exercises).toEqual([]);
    expect(result.blocks[0].supersets).toHaveLength(1);
    expect(result.blocks[0].structure).toBe('superset');
  });

  it('should propagate API errors with detail message', async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse(
        { detail: 'Instagram auto-extraction requires a Pro or Trainer subscription.' },
        403,
      ),
    );

    await expect(
      generateWorkoutStructure([
        { type: 'instagram', content: 'https://www.instagram.com/reel/ABC/' },
      ]),
    ).rejects.toThrow('Instagram auto-extraction requires a Pro or Trainer subscription');
  });
});
