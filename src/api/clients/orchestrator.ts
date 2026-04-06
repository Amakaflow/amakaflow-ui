/**
 * Orchestrator API client — agentic training operations.
 */
import { authenticatedFetch } from '../../lib/authenticated-fetch';
import { API_URLS } from '../../lib/config';

const BASE = API_URLS.ORCHESTRATOR;

export interface AgentResponse {
  response: string;
  intent: string;
  confidence: number;
  thread_id: string;
  trace_id: string;
  tool_results: Record<string, unknown>[];
  matched_rules: string[];
  approval_status: string;
  proposed_actions: Record<string, unknown>[];
}

export interface ThreadStatus {
  thread_id: string;
  status: 'running' | 'paused' | 'completed' | 'error' | 'not_found';
  approval_required: boolean;
  proposed_actions: Record<string, unknown>[];
  response: string;
}

async function call<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...options.headers };
  const r = await authenticatedFetch(url, { ...options, headers });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `Orchestrator error: ${r.status}`);
  }
  return r.json();
}

export async function sendMessage(message: string, channel = 'web'): Promise<AgentResponse> {
  return call<AgentResponse>(`${BASE}/agent`, {
    method: 'POST',
    body: JSON.stringify({ message, channel }),
  });
}

export async function approveThread(threadId: string): Promise<AgentResponse> {
  return call<AgentResponse>(`${BASE}/agent/${encodeURIComponent(threadId)}/approve`, {
    method: 'POST',
  });
}

export async function rejectThread(threadId: string): Promise<AgentResponse> {
  return call<AgentResponse>(`${BASE}/agent/${encodeURIComponent(threadId)}/reject`, {
    method: 'POST',
  });
}

export async function getThreadStatus(threadId: string): Promise<ThreadStatus> {
  return call<ThreadStatus>(`${BASE}/agent/${encodeURIComponent(threadId)}/status`);
}
