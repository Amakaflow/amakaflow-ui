import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeIngest, type InputType } from '../stepExecutors';
import { API_URLS } from '../../../lib/config';

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
