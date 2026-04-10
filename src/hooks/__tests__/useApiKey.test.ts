import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/mocks/server';

// Mock authenticated-fetch to bypass Clerk auth
vi.mock('../../lib/authenticated-fetch', () => ({
  authenticatedApiCall: vi.fn(),
}));

import { useApiKey } from '../useApiKey';
import { authenticatedApiCall } from '../../lib/authenticated-fetch';

const mockApiCall = vi.mocked(authenticatedApiCall);

describe('useApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches key status on mount', async () => {
    mockApiCall.mockResolvedValueOnce({
      has_key: true,
      provider: 'anthropic',
      is_valid: true,
      last_validated_at: '2026-04-10T00:00:00Z',
    });

    const { result } = renderHook(() => useApiKey());
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.status?.has_key).toBe(true);
    expect(result.current.status?.provider).toBe('anthropic');
    expect(result.current.error).toBeNull();
  });

  it('sets default status on fetch error', async () => {
    mockApiCall.mockRejectedValueOnce(new Error('Unauthorized'));

    const { result } = renderHook(() => useApiKey());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.status?.has_key).toBe(false);
    expect(result.current.error).toBe('Unauthorized');
  });

  it('saveKey stores key and refreshes status', async () => {
    // Initial fetch
    mockApiCall.mockResolvedValueOnce({
      has_key: false, provider: null, is_valid: false, last_validated_at: null,
    });

    const { result } = renderHook(() => useApiKey());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Save key call + refresh call
    mockApiCall
      .mockResolvedValueOnce({ status: 'ok', provider: 'openai', message: 'Stored' })
      .mockResolvedValueOnce({ has_key: true, provider: 'openai', is_valid: true, last_validated_at: '2026-04-10' });

    let success: boolean;
    await act(async () => {
      success = await result.current.saveKey('openai', 'sk-test-123');
    });

    expect(success!).toBe(true);
    expect(result.current.status?.has_key).toBe(true);
    expect(result.current.isSaving).toBe(false);
  });

  it('saveKey returns false on error', async () => {
    mockApiCall.mockResolvedValueOnce({
      has_key: false, provider: null, is_valid: false, last_validated_at: null,
    });

    const { result } = renderHook(() => useApiKey());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockApiCall.mockRejectedValueOnce(new Error('Invalid key'));

    let success: boolean;
    await act(async () => {
      success = await result.current.saveKey('anthropic', 'bad-key');
    });

    expect(success!).toBe(false);
    expect(result.current.error).toBe('Invalid key');
  });

  it('removeKey deletes key and refreshes', async () => {
    mockApiCall.mockResolvedValueOnce({
      has_key: true, provider: 'anthropic', is_valid: true, last_validated_at: '2026-04-10',
    });

    const { result } = renderHook(() => useApiKey());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockApiCall
      .mockResolvedValueOnce({ status: 'ok', message: 'Deleted' })
      .mockResolvedValueOnce({ has_key: false, provider: null, is_valid: false, last_validated_at: null });

    let success: boolean;
    await act(async () => {
      success = await result.current.removeKey();
    });

    expect(success!).toBe(true);
    expect(result.current.status?.has_key).toBe(false);
  });
});
