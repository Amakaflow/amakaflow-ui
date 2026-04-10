import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setGlobalTokenGetter, getAuthToken, authenticatedFetch } from '../authenticated-fetch';

describe('authenticated-fetch', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok'));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setGlobalTokenGetter(null as any);
  });

  describe('getAuthToken', () => {
    it('returns null when no token getter is set', async () => {
      const token = await getAuthToken();
      expect(token).toBeNull();
    });

    it('returns token from getter when set', async () => {
      setGlobalTokenGetter(async () => 'test-jwt-token');
      const token = await getAuthToken();
      expect(token).toBe('test-jwt-token');
    });
  });

  describe('authenticatedFetch', () => {
    it('makes fetch call to the given URL', async () => {
      await authenticatedFetch('http://localhost:8001/health');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:8001/health',
        expect.any(Object),
      );
    });

    it('adds Authorization header when token is available', async () => {
      setGlobalTokenGetter(async () => 'my-token');
      await authenticatedFetch('http://localhost:8001/test');

      const callArgs = (globalThis.fetch as any).mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers.get('Authorization')).toBe('Bearer my-token');
    });

    it('passes through request options', async () => {
      await authenticatedFetch('http://localhost:8001/test', { method: 'POST', body: '{}' });
      const callArgs = (globalThis.fetch as any).mock.calls[0];
      expect(callArgs[1].method).toBe('POST');
      expect(callArgs[1].body).toBe('{}');
    });
  });
});
