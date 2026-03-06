import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeIngest, executeExport, type InputType } from '../stepExecutors';

describe('executeIngest routing', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('routes text to /ingest/ai_workout with plain text body', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ blocks: [] }),
    } as Response);

    const result = await executeIngest('bench press 3x10', 'text');

    expect(result.request.url).toContain('/ingest/ai_workout');
    expect(result.request.headers['Content-Type']).toBe('text/plain');
  });

  it('routes youtube to /ingest/youtube with JSON body', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ blocks: [] }),
    } as Response);

    const result = await executeIngest('https://youtube.com/watch?v=abc', 'youtube');

    expect(result.request.url).toContain('/ingest/youtube');
    expect(result.request.headers['Content-Type']).toBe('application/json');
  });

  it('routes instagram to /ingest/instagram_reel', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ blocks: [] }),
    } as Response);

    const result = await executeIngest('https://instagram.com/reel/abc', 'instagram');

    expect(result.request.url).toContain('/ingest/instagram_reel');
    expect(result.request.headers['Content-Type']).toBe('application/json');
  });

  it('routes tiktok to /ingest/tiktok', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ blocks: [] }),
    } as Response);

    const result = await executeIngest('https://tiktok.com/@user/video/123', 'tiktok');

    expect(result.request.url).toContain('/ingest/tiktok');
    expect(result.request.headers['Content-Type']).toBe('application/json');
  });

  it('routes generic url to /ingest/url', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ blocks: [] }),
    } as Response);

    const result = await executeIngest('https://example.com/workout', 'url');

    expect(result.request.url).toContain('/ingest/url');
    expect(result.request.headers['Content-Type']).toBe('application/json');
  });

  it('sends JSON body with url field for youtube', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ blocks: [] }),
    } as Response);

    await executeIngest('https://youtube.com/watch?v=abc', 'youtube');

    const fetchCall = mockFetch.mock.calls[0];
    const body = fetchCall?.[1]?.body as string;
    expect(body).toBe(JSON.stringify({ url: 'https://youtube.com/watch?v=abc' }));
  });

  it('sends plain text body for text input', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ blocks: [] }),
    } as Response);

    await executeIngest('bench press 3x10', 'text');

    const fetchCall = mockFetch.mock.calls[0];
    const body = fetchCall?.[1]?.body;
    expect(body).toBe('bench press 3x10');
  });

  it('defaults to text input type', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ blocks: [] }),
    } as Response);

    // Call without second argument
    await executeIngest('bench press 3x10');

    expect(mockFetch).toHaveBeenCalled();
    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall?.[0]).toContain('/ingest/ai_workout');
  });
});

describe('executeExport', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
