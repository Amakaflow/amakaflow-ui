import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeIngest, executeExport, INGEST_ENDPOINTS } from '../stepExecutors';
import type { InputType } from '../../store/runTypes';

describe('executeIngest', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls /ingest/ai_workout endpoint for text input', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'Test', blocks: [] }),
    } as Response);

    await executeIngest('bench press 3x10', 'text');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8004/ingest/ai_workout',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', 'x-test-user-id': 'observatory-test' },
        body: 'bench press 3x10',
      })
    );
  });

  it('calls /ingest/youtube endpoint for youtube input', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'Test', blocks: [] }),
    } as Response);

    await executeIngest('https://youtube.com/watch?v=abc', 'youtube');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8004/ingest/youtube',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-user-id': 'observatory-test' },
        body: JSON.stringify({ url: 'https://youtube.com/watch?v=abc' }),
      })
    );
  });

  it('calls /ingest/instagram_reel endpoint for instagram input', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'Test', blocks: [] }),
    } as Response);

    await executeIngest('https://instagram.com/reel/abc', 'instagram');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8004/ingest/instagram_reel',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-user-id': 'observatory-test' },
        body: JSON.stringify({ url: 'https://instagram.com/reel/abc' }),
      })
    );
  });

  it('calls /ingest/tiktok endpoint for tiktok input', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'Test', blocks: [] }),
    } as Response);

    await executeIngest('https://tiktok.com/@user/video/abc', 'tiktok');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8004/ingest/tiktok',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-user-id': 'observatory-test' },
        body: JSON.stringify({ url: 'https://tiktok.com/@user/video/abc' }),
      })
    );
  });

  it('calls /ingest/url endpoint for generic url input', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'Test', blocks: [] }),
    } as Response);

    await executeIngest('https://example.com/workout', 'url');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8004/ingest/url',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-user-id': 'observatory-test' },
        body: JSON.stringify({ url: 'https://example.com/workout' }),
      })
    );
  });

  it('defaults to text endpoint when inputType is not provided', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'Test', blocks: [] }),
    } as Response);

    // Call without inputType
    await executeIngest('bench press 3x10');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8004/ingest/ai_workout',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('returns error when fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));

    const result = await executeIngest('bench press', 'text');

    expect(result.error).toContain('Network error');
    expect(result.apiOutput).toBeUndefined();
  });

  it('returns HTTP error status in error message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' }),
    } as Response);

    const result = await executeIngest('bench press', 'text');

    expect(result.error).toBe('HTTP 500');
  });
});

describe('INGEST_ENDPOINTS', () => {
  it('has all required input types', () => {
    const expectedTypes: InputType[] = ['text', 'youtube', 'instagram', 'tiktok', 'url'];
    expectedTypes.forEach(type => {
      expect(INGEST_ENDPOINTS[type]).toBeDefined();
    });
  });

  it('maps text to ai_workout', () => {
    expect(INGEST_ENDPOINTS.text).toBe('/ingest/ai_workout');
  });

  it('maps youtube to youtube', () => {
    expect(INGEST_ENDPOINTS.youtube).toBe('/ingest/youtube');
  });

  it('maps instagram to instagram_reel', () => {
    expect(INGEST_ENDPOINTS.instagram).toBe('/ingest/instagram_reel');
  });

  it('maps tiktok to tiktok', () => {
    expect(INGEST_ENDPOINTS.tiktok).toBe('/ingest/tiktok');
  });

  it('maps url to url', () => {
    expect(INGEST_ENDPOINTS.url).toBe('/ingest/url');
  });
});

describe('executeExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls POST /workout/sync/garmin with blocks_json and workout_title', async () => {
    const mockStructure = { blocks: [], title: 'Test Workout' };
    const mockResponse = { success: true };
    
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as unknown as Response);
    
    const result = await executeExport(mockStructure, 'Test Workout');
    
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8001/workout/sync/garmin',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-user-id': 'observatory-test' },
        body: JSON.stringify({
          blocks_json: mockStructure,
          workout_title: 'Test Workout',
        }),
        signal: expect.any(AbortSignal),
      })
    );
    expect(result.request?.url).toContain('/workout/sync/garmin');
    expect(result.request?.body).toEqual({
      blocks_json: mockStructure,
      workout_title: 'Test Workout',
    });
    expect(result.response?.status).toBe(200);
  });

  it('returns error on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ detail: 'Not Found' }),
    } as unknown as Response);
    
    const result = await executeExport({}, 'Test');
    expect(result.error).toBe('HTTP 404');
  });

  it('returns error on network failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
    
    const result = await executeExport({}, 'Test');
    expect(result.error).toContain('Network error');
  });
});
