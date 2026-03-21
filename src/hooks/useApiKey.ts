/**
 * Hook for managing BYOK (Bring Your Own Key) API key state.
 *
 * AMA-1135: Provides functions to store, validate, check status, and delete
 * user-provided AI API keys via the chat-api backend.
 */

import { useState, useEffect, useCallback } from 'react';
import { API_URLS } from '../lib/config';
import { authenticatedApiCall } from '../lib/authenticated-fetch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AiProvider = 'anthropic' | 'openai';

export interface ApiKeyStatus {
  has_key: boolean;
  provider: AiProvider | null;
  is_valid: boolean;
  last_validated_at: string | null;
}

export interface StoreApiKeyResponse {
  status: string;
  provider: string;
  message: string;
}

export interface DeleteApiKeyResponse {
  status: string;
  message: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

const SETTINGS_BASE = `${API_URLS.CHAT}/settings`;

async function fetchApiKeyStatus(): Promise<ApiKeyStatus> {
  return authenticatedApiCall<ApiKeyStatus>(`${SETTINGS_BASE}/api-key/status`);
}

async function storeApiKey(provider: AiProvider, apiKey: string): Promise<StoreApiKeyResponse> {
  return authenticatedApiCall<StoreApiKeyResponse>(`${SETTINGS_BASE}/api-key`, {
    method: 'POST',
    body: JSON.stringify({ provider, api_key: apiKey }),
  });
}

async function deleteApiKey(provider?: AiProvider): Promise<DeleteApiKeyResponse> {
  const url = provider
    ? `${SETTINGS_BASE}/api-key?provider=${provider}`
    : `${SETTINGS_BASE}/api-key`;
  return authenticatedApiCall<DeleteApiKeyResponse>(url, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseApiKeyReturn {
  /** Current key status (null while loading) */
  status: ApiKeyStatus | null;
  /** Whether the initial status fetch is loading */
  isLoading: boolean;
  /** Whether a save/delete operation is in progress */
  isSaving: boolean;
  /** Error message from the last operation */
  error: string | null;
  /** Save a new API key (validates + stores) */
  saveKey: (provider: AiProvider, apiKey: string) => Promise<boolean>;
  /** Remove the stored API key */
  removeKey: (provider?: AiProvider) => Promise<boolean>;
  /** Refresh the key status from the server */
  refresh: () => Promise<void>;
}

export function useApiKey(): UseApiKeyReturn {
  const [status, setStatus] = useState<ApiKeyStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchApiKeyStatus();
      setStatus(data);
    } catch (err: any) {
      console.error('Failed to fetch API key status:', err);
      setError(err.message || 'Failed to load API key status');
      // Set a default empty status so the UI still renders
      setStatus({ has_key: false, provider: null, is_valid: false, last_validated_at: null });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveKey = useCallback(async (provider: AiProvider, apiKey: string): Promise<boolean> => {
    try {
      setIsSaving(true);
      setError(null);
      await storeApiKey(provider, apiKey);
      await refresh();
      return true;
    } catch (err: any) {
      console.error('Failed to save API key:', err);
      setError(err.message || 'Failed to save API key');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [refresh]);

  const removeKey = useCallback(async (provider?: AiProvider): Promise<boolean> => {
    try {
      setIsSaving(true);
      setError(null);
      await deleteApiKey(provider);
      await refresh();
      return true;
    } catch (err: any) {
      console.error('Failed to remove API key:', err);
      setError(err.message || 'Failed to remove API key');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [refresh]);

  return {
    status,
    isLoading,
    isSaving,
    error,
    saveKey,
    removeKey,
    refresh,
  };
}
