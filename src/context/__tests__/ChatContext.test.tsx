/**
 * Integration tests for ChatContext provider.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

// Mock useChatStream to avoid importing chat-api
vi.mock('../../hooks/useChatStream', () => ({
  useChatStream: () => ({
    sendMessage: vi.fn(),
    cancelStream: vi.fn(),
  }),
}));

import { ChatProvider, useChat } from '../ChatContext';

// ── Helpers ──────────────────────────────────────────────────────────

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ChatProvider>{children}</ChatProvider>
);

// ── Tests ────────────────────────────────────────────────────────────

describe('ChatContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Provider wiring
  it('useChat throws when used outside ChatProvider', () => {
    // Suppress console error from React
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      renderHook(() => useChat());
    }).toThrow('useChat must be used within a ChatProvider');
    spy.mockRestore();
  });

  it('ChatProvider provides all expected context methods', () => {
    const { result } = renderHook(() => useChat(), { wrapper });
    expect(result.current.state).toBeDefined();
    expect(typeof result.current.togglePanel).toBe('function');
    expect(typeof result.current.openPanel).toBe('function');
    expect(typeof result.current.closePanel).toBe('function');
    expect(typeof result.current.sendMessage).toBe('function');
    expect(typeof result.current.cancelStream).toBe('function');
    expect(typeof result.current.clearSession).toBe('function');
  });

  it('togglePanel updates isOpen', () => {
    const { result } = renderHook(() => useChat(), { wrapper });

    expect(result.current.state.isOpen).toBe(false);

    act(() => result.current.togglePanel());
    expect(result.current.state.isOpen).toBe(true);

    act(() => result.current.togglePanel());
    expect(result.current.state.isOpen).toBe(false);
  });

  it('openPanel / closePanel set isOpen', () => {
    const { result } = renderHook(() => useChat(), { wrapper });

    act(() => result.current.openPanel());
    expect(result.current.state.isOpen).toBe(true);

    act(() => result.current.closePanel());
    expect(result.current.state.isOpen).toBe(false);
  });

  it('clearSession resets session state', () => {
    const { result } = renderHook(() => useChat(), { wrapper });

    // Toggle open so we can verify it's preserved
    act(() => result.current.openPanel());
    act(() => result.current.clearSession());

    expect(result.current.state.sessionId).toBeNull();
    expect(result.current.state.messages).toEqual([]);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.isOpen).toBe(true); // preserved
  });

  // localStorage persistence
  it('initial state reads sessionId from localStorage via lazy initializer', () => {
    localStorage.setItem('amakaflow_chat_session', 'persisted-id');

    // With lazy initializer, useReducer reads localStorage on each ChatProvider mount
    const { result } = renderHook(() => useChat(), { wrapper });

    expect(result.current.state.sessionId).toBe('persisted-id');
  });

  it('localStorage.removeItem called on CLEAR_SESSION', () => {
    const removeSpy = vi.spyOn(window.localStorage, 'removeItem');
    const { result } = renderHook(() => useChat(), { wrapper });

    act(() => result.current.clearSession());

    // The effect runs because sessionId becomes null
    expect(removeSpy).toHaveBeenCalledWith('amakaflow_chat_session');
    removeSpy.mockRestore();
  });

  it('localStorage errors are caught silently', () => {
    // Make localStorage.setItem throw
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    // Should not throw
    expect(() => {
      const { result } = renderHook(() => useChat(), { wrapper });
      act(() => result.current.togglePanel()); // Trigger a re-render/effect
    }).not.toThrow();

    setSpy.mockRestore();
  });
});
