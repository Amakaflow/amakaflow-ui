/**
 * Unit tests for ChatInput component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from '../ChatInput';

// ── Tests ────────────────────────────────────────────────────────────

describe('ChatInput', () => {
  // Sending
  it('calls onSend with trimmed text when send button clicked', async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} isStreaming={false} rateLimitInfo={null} />);

    const textarea = screen.getByTestId('chat-input-textarea');
    fireEvent.change(textarea, { target: { value: '  hello  ' } });

    await userEvent.click(screen.getByTestId('chat-send-button'));
    expect(onSend).toHaveBeenCalledWith('hello');
  });

  it('calls onSend on Enter key press', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} isStreaming={false} rateLimitInfo={null} />);

    const textarea = screen.getByTestId('chat-input-textarea');
    fireEvent.change(textarea, { target: { value: 'test msg' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(onSend).toHaveBeenCalledWith('test msg');
  });

  it('does NOT call onSend on Shift+Enter', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} isStreaming={false} rateLimitInfo={null} />);

    const textarea = screen.getByTestId('chat-input-textarea');
    fireEvent.change(textarea, { target: { value: 'line' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('does NOT call onSend when textarea is empty', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} isStreaming={false} rateLimitInfo={null} />);

    const textarea = screen.getByTestId('chat-input-textarea');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('clears textarea after sending', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} isStreaming={false} rateLimitInfo={null} />);

    const textarea = screen.getByTestId('chat-input-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'msg' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(textarea.value).toBe('');
  });

  it('send button is disabled when isStreaming=true', () => {
    render(<ChatInput onSend={vi.fn()} isStreaming={true} rateLimitInfo={null} />);
    expect(screen.getByTestId('chat-send-button')).toBeDisabled();
  });

  it('send button is disabled when textarea is empty', () => {
    render(<ChatInput onSend={vi.fn()} isStreaming={false} rateLimitInfo={null} />);
    expect(screen.getByTestId('chat-send-button')).toBeDisabled();
  });

  it('send button is enabled when textarea has text and not streaming', () => {
    render(<ChatInput onSend={vi.fn()} isStreaming={false} rateLimitInfo={null} />);
    const textarea = screen.getByTestId('chat-input-textarea');
    fireEvent.change(textarea, { target: { value: 'text' } });
    expect(screen.getByTestId('chat-send-button')).not.toBeDisabled();
  });

  it('textarea is disabled when isStreaming=true', () => {
    render(<ChatInput onSend={vi.fn()} isStreaming={true} rateLimitInfo={null} />);
    expect(screen.getByTestId('chat-input-textarea')).toBeDisabled();
  });

  // Rate limit display
  it('shows rate limit text when rateLimitInfo is provided', () => {
    render(<ChatInput onSend={vi.fn()} isStreaming={false} rateLimitInfo={{ usage: 45, limit: 50 }} />);
    const rateLimit = screen.getByTestId('chat-rate-limit');
    expect(rateLimit).toHaveTextContent('45/50 messages');
  });

  it('hides rate limit text when rateLimitInfo is null', () => {
    render(<ChatInput onSend={vi.fn()} isStreaming={false} rateLimitInfo={null} />);
    expect(screen.queryByTestId('chat-rate-limit')).not.toBeInTheDocument();
  });

  // Mic button
  it('mic button is rendered but disabled', () => {
    render(<ChatInput onSend={vi.fn()} isStreaming={false} rateLimitInfo={null} />);
    expect(screen.getByTestId('chat-mic-button')).toBeDisabled();
  });

  // Accessibility
  it('send button has aria-label', () => {
    render(<ChatInput onSend={vi.fn()} isStreaming={false} rateLimitInfo={null} />);
    expect(screen.getByTestId('chat-send-button')).toHaveAttribute('aria-label', 'Send message');
  });

  it('mic button has aria-label', () => {
    render(<ChatInput onSend={vi.fn()} isStreaming={false} rateLimitInfo={null} />);
    expect(screen.getByTestId('chat-mic-button')).toHaveAttribute('aria-label', 'Voice input');
  });
});
