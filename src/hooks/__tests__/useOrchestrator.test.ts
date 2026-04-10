import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock the orchestrator API module before importing the hook
vi.mock('../../api/clients/orchestrator', () => ({
  sendMessage: vi.fn(),
  approveThread: vi.fn(),
  rejectThread: vi.fn(),
}));

import { useOrchestrator } from '../useOrchestrator';
import { sendMessage, approveThread, rejectThread } from '../../api/clients/orchestrator';

const mockSendMessage = vi.mocked(sendMessage);
const mockApproveThread = vi.mocked(approveThread);
const mockRejectThread = vi.mocked(rejectThread);

describe('useOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with idle state', () => {
    const { result } = renderHook(() => useOrchestrator());
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.lastResponse).toBeNull();
    expect(result.current.isApprovalPending).toBe(false);
  });

  it('send calls sendMessage and stores response', async () => {
    const mockResponse = { message: 'done', approval_status: null };
    mockSendMessage.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useOrchestrator());

    await act(async () => {
      const res = await result.current.send('hello');
      expect(res).toEqual(mockResponse);
    });

    expect(result.current.lastResponse).toEqual(mockResponse);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('send sets error on failure', async () => {
    mockSendMessage.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useOrchestrator());

    await act(async () => {
      const res = await result.current.send('hello');
      expect(res).toBeNull();
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.loading).toBe(false);
  });

  it('approve calls approveThread', async () => {
    const mockResponse = { message: 'approved', approval_status: null };
    mockApproveThread.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useOrchestrator());

    await act(async () => {
      await result.current.approve('thread-123');
    });

    expect(mockApproveThread).toHaveBeenCalledWith('thread-123');
    expect(result.current.lastResponse).toEqual(mockResponse);
  });

  it('reject calls rejectThread', async () => {
    const mockResponse = { message: 'rejected', approval_status: null };
    mockRejectThread.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useOrchestrator());

    await act(async () => {
      await result.current.reject('thread-456');
    });

    expect(mockRejectThread).toHaveBeenCalledWith('thread-456');
    expect(result.current.lastResponse).toEqual(mockResponse);
  });

  it('isApprovalPending reflects response status', async () => {
    mockSendMessage.mockResolvedValue({ message: 'pending', approval_status: 'pending' });

    const { result } = renderHook(() => useOrchestrator());

    await act(async () => {
      await result.current.send('do something risky');
    });

    expect(result.current.isApprovalPending).toBe(true);
  });
});
