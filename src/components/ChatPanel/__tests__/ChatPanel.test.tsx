/**
 * Unit tests for ChatPanel component.
 * Mocks useChat context to control state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatPanel } from '../ChatPanel';
import type { ChatMessage } from '../../../types/chat';

// Mock useChat
const mockTogglePanel = vi.fn();
const mockClosePanel = vi.fn();
const mockSendMessage = vi.fn();
const mockClearSession = vi.fn();
const mockCancelStream = vi.fn();
const mockOpenPanel = vi.fn();

let mockState = {
  isOpen: false,
  sessionId: null as string | null,
  messages: [] as ChatMessage[],
  isStreaming: false,
  error: null as string | null,
  rateLimitInfo: null,
};

vi.mock('../../../context/ChatContext', () => ({
  useChat: () => ({
    state: mockState,
    togglePanel: mockTogglePanel,
    closePanel: mockClosePanel,
    openPanel: mockOpenPanel,
    sendMessage: mockSendMessage,
    clearSession: mockClearSession,
    cancelStream: mockCancelStream,
  }),
}));

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState = {
      isOpen: false,
      sessionId: null,
      messages: [],
      isStreaming: false,
      error: null,
      rateLimitInfo: null,
    };
  });

  // Toggle behavior
  it('shows trigger button when panel is closed', () => {
    render(<ChatPanel />);
    expect(screen.getByTestId('chat-trigger-button')).toBeInTheDocument();
  });

  it('shows panel when isOpen=true', () => {
    mockState.isOpen = true;
    render(<ChatPanel />);
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
  });

  it('hides trigger button when panel is open', () => {
    mockState.isOpen = true;
    render(<ChatPanel />);
    expect(screen.queryByTestId('chat-trigger-button')).not.toBeInTheDocument();
  });

  it('clicking trigger button calls togglePanel', async () => {
    render(<ChatPanel />);
    await userEvent.click(screen.getByTestId('chat-trigger-button'));
    expect(mockTogglePanel).toHaveBeenCalled();
  });

  // Panel content
  it('shows empty state message when no messages', () => {
    mockState.isOpen = true;
    render(<ChatPanel />);
    expect(screen.getByTestId('chat-empty-state')).toBeInTheDocument();
    expect(screen.getByText(/Ask me anything/)).toBeInTheDocument();
  });

  it('renders messages when messages exist', () => {
    mockState.isOpen = true;
    mockState.messages = [
      { id: 'u1', role: 'user', content: 'What is HYROX?', timestamp: Date.now() },
      { id: 'a1', role: 'assistant', content: 'HYROX is a fitness race.', timestamp: Date.now() },
    ];
    render(<ChatPanel />);
    expect(screen.getByTestId('chat-messages-area')).toBeInTheDocument();
    expect(screen.getByText('What is HYROX?')).toBeInTheDocument();
    expect(screen.getByText('HYROX is a fitness race.')).toBeInTheDocument();
  });

  it('shows error banner when state.error is set', () => {
    mockState.isOpen = true;
    mockState.error = 'Connection failed';
    render(<ChatPanel />);
    const banner = screen.getByTestId('chat-error-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('Connection failed');
  });

  // Header actions
  it('clicking trash icon calls clearSession', async () => {
    mockState.isOpen = true;
    render(<ChatPanel />);
    await userEvent.click(screen.getByTestId('chat-clear-button'));
    expect(mockClearSession).toHaveBeenCalled();
  });

  it('clicking close calls closePanel', async () => {
    mockState.isOpen = true;
    render(<ChatPanel />);
    await userEvent.click(screen.getByTestId('chat-close-button'));
    expect(mockClosePanel).toHaveBeenCalled();
  });

  // Accessibility
  it('panel has role="dialog" and aria-label', () => {
    mockState.isOpen = true;
    render(<ChatPanel />);
    const panel = screen.getByTestId('chat-panel');
    expect(panel).toHaveAttribute('role', 'dialog');
    expect(panel).toHaveAttribute('aria-label', 'Chat with AI Assistant');
    expect(panel).toHaveAttribute('aria-modal', 'false');
  });
});
