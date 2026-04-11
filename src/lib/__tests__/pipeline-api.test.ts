import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../authenticated-fetch', () => ({ authenticatedFetch: vi.fn() }));

import { streamPipeline } from '../pipeline-api';
import { authenticatedFetch } from '../authenticated-fetch';

const mockFetch = vi.mocked(authenticatedFetch);

describe('streamPipeline', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls onError on network failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network down'));
    const onError = vi.fn();
    const onEvent = vi.fn();

    await streamPipeline({
      endpoint: '/pipeline/test',
      body: {},
      onEvent,
      onError,
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError.mock.calls[0][0].message).toBe('Network down');
  });

  it('calls onError when response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve('Something broke'),
    } as any);
    const onError = vi.fn();
    const onEvent = vi.fn();

    await streamPipeline({
      endpoint: '/pipeline/test',
      body: {},
      onEvent,
      onError,
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError.mock.calls[0][0].message).toContain('500');
  });

  it('calls onError when response body is missing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: null,
    } as any);
    const onError = vi.fn();
    const onEvent = vi.fn();

    await streamPipeline({
      endpoint: '/pipeline/test',
      body: {},
      onEvent,
      onError,
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError.mock.calls[0][0].message).toContain('no body');
  });

  it('silently returns on AbortError', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValue(abortError);
    const onError = vi.fn();

    await streamPipeline({
      endpoint: '/pipeline/test',
      body: {},
      onEvent: vi.fn(),
      onError,
    });

    // AbortError should not call onError
    expect(onError).not.toHaveBeenCalled();
  });
});
