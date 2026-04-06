import { useState, useCallback } from 'react';
import { sendMessage, approveThread, rejectThread, type AgentResponse } from '../api/clients/orchestrator';

export function useOrchestrator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<AgentResponse | null>(null);

  const send = useCallback(async (message: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await sendMessage(message);
      setLastResponse(result);
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const approve = useCallback(async (threadId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await approveThread(threadId);
      setLastResponse(result);
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reject = useCallback(async (threadId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await rejectThread(threadId);
      setLastResponse(result);
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    send,
    approve,
    reject,
    loading,
    error,
    lastResponse,
    isApprovalPending: lastResponse?.approval_status === 'pending',
  };
}
