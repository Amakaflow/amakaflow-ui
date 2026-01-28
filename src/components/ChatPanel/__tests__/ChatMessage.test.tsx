/**
 * Unit tests for ChatMessage component.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMessage } from '../ChatMessage';
import type { ChatMessage as ChatMessageType, ChatToolCall } from '../../../types/chat';

// ── Helpers ──────────────────────────────────────────────────────────

function userMsg(content = 'Hello'): ChatMessageType {
  return { id: 'u1', role: 'user', content, timestamp: Date.now() };
}

function assistantMsg(content = 'Reply', extra?: Partial<ChatMessageType>): ChatMessageType {
  return { id: 'a1', role: 'assistant', content, timestamp: Date.now(), ...extra };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('ChatMessage', () => {
  // Rendering basics
  it('renders user message content', () => {
    render(<ChatMessage message={userMsg('Hi there')} />);
    expect(screen.getByText('Hi there')).toBeInTheDocument();
  });

  it('renders assistant message content', () => {
    render(<ChatMessage message={assistantMsg('Some reply')} />);
    expect(screen.getByText('Some reply')).toBeInTheDocument();
  });

  it('renders timestamp', () => {
    const ts = new Date(2025, 0, 15, 14, 30).getTime();
    render(<ChatMessage message={{ ...userMsg(), timestamp: ts }} />);
    const timestamp = screen.getByTestId('chat-message-timestamp');
    expect(timestamp).toBeInTheDocument();
    expect(timestamp.textContent).toMatch(/\d{1,2}:\d{2}/);
  });

  // Role-based test IDs and alignment
  it('user message has data-testid="chat-message-user"', () => {
    render(<ChatMessage message={userMsg()} />);
    const el = screen.getByTestId('chat-message-user');
    expect(el).toBeInTheDocument();
    expect(el.className).toContain('justify-end');
  });

  it('assistant message has data-testid="chat-message-assistant"', () => {
    render(<ChatMessage message={assistantMsg()} />);
    const el = screen.getByTestId('chat-message-assistant');
    expect(el).toBeInTheDocument();
    expect(el.className).toContain('justify-start');
  });

  it('message carries data-message-id attribute', () => {
    render(<ChatMessage message={userMsg()} />);
    const el = screen.getByTestId('chat-message-user');
    expect(el).toHaveAttribute('data-message-id', 'u1');
  });

  // Streaming indicator
  it('shows streaming indicator when isStreaming=true and content is empty', () => {
    render(<ChatMessage message={assistantMsg('')} isStreaming />);
    expect(screen.getByTestId('chat-streaming-indicator')).toBeInTheDocument();
  });

  it('hides streaming indicator when isStreaming=true but content exists', () => {
    render(<ChatMessage message={assistantMsg('has text')} isStreaming />);
    expect(screen.queryByTestId('chat-streaming-indicator')).not.toBeInTheDocument();
  });

  it('hides streaming indicator when isStreaming=false', () => {
    render(<ChatMessage message={assistantMsg('')} isStreaming={false} />);
    expect(screen.queryByTestId('chat-streaming-indicator')).not.toBeInTheDocument();
  });

  // Tool calls
  it('renders tool call card with tool name', () => {
    const tc: ChatToolCall[] = [{ id: 'tc1', name: 'search_workouts', status: 'running' }];
    render(<ChatMessage message={assistantMsg('', { tool_calls: tc })} />);
    expect(screen.getByTestId('chat-tool-call')).toBeInTheDocument();
    expect(screen.getByText('search_workouts')).toBeInTheDocument();
  });

  it('shows spinner for status=running', () => {
    const tc: ChatToolCall[] = [{ id: 'tc1', name: 'search', status: 'running' }];
    render(<ChatMessage message={assistantMsg('', { tool_calls: tc })} />);
    expect(screen.getByTestId('chat-tool-spinner')).toBeInTheDocument();
  });

  it('shows check icon for status=completed', () => {
    const tc: ChatToolCall[] = [{ id: 'tc1', name: 'search', status: 'completed', result: 'ok' }];
    render(<ChatMessage message={assistantMsg('', { tool_calls: tc })} />);
    expect(screen.queryByTestId('chat-tool-spinner')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-tool-complete')).toBeInTheDocument();
  });

  it('renders multiple tool calls', () => {
    const tcs: ChatToolCall[] = [
      { id: 'tc1', name: 'tool_a', status: 'completed', result: 'ok' },
      { id: 'tc2', name: 'tool_b', status: 'running' },
    ];
    render(<ChatMessage message={assistantMsg('', { tool_calls: tcs })} />);
    const cards = screen.getAllByTestId('chat-tool-call');
    expect(cards).toHaveLength(2);
    expect(screen.getByText('tool_a')).toBeInTheDocument();
    expect(screen.getByText('tool_b')).toBeInTheDocument();
  });

  // Markdown rendering
  it('renders inline code in assistant messages', () => {
    render(<ChatMessage message={assistantMsg('Use `console.log`')} />);
    const code = screen.getByText('console.log');
    expect(code.tagName).toBe('CODE');
  });

  it('renders markdown lists in assistant messages', () => {
    render(<ChatMessage message={assistantMsg('- item one\n- item two')} />);
    expect(screen.getByText('item one')).toBeInTheDocument();
    expect(screen.getByText('item two')).toBeInTheDocument();
  });
});
