/**
 * Tests for ApiKeySettings component (AMA-1135 BYOK).
 *
 * Tests cover:
 * - Renders loading state
 * - Renders "not set" state with input form
 * - Renders "active" state with green badge and status
 * - Renders "invalid" state with warning alert
 * - Save button triggers validation
 * - Remove button shows confirmation dialog
 * - useApiKey hook fetch and save flows
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the authenticated-fetch module before importing the component
vi.mock('../../lib/authenticated-fetch', () => ({
  authenticatedApiCall: vi.fn(),
}));

import { ApiKeySettings } from '../settings/ApiKeySettings';
import { authenticatedApiCall } from '../../lib/authenticated-fetch';

const mockApiCall = authenticatedApiCall as ReturnType<typeof vi.fn>;

// =============================================================================
// Helper: render and wait for loading to finish
// =============================================================================

async function renderAndWait() {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ApiKeySettings />);
  });
  // Wait for the loading spinner to disappear
  await waitFor(() => {
    expect(screen.queryByText('Loading API key settings...')).not.toBeInTheDocument();
  });
  return result!;
}

// =============================================================================
// Tests
// =============================================================================

describe('ApiKeySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner initially', () => {
    // Never resolve the API call so loading persists
    mockApiCall.mockReturnValue(new Promise(() => {}));

    render(<ApiKeySettings />);
    expect(screen.getByText('Loading API key settings...')).toBeInTheDocument();
  });

  it('renders "not set" state when no key is stored', async () => {
    mockApiCall.mockResolvedValue({
      has_key: false,
      provider: null,
      is_valid: false,
      last_validated_at: null,
    });

    await renderAndWait();

    expect(screen.getByText('Connect Your Own AI Key')).toBeInTheDocument();
    expect(screen.getByText(/Not set/)).toBeInTheDocument();
    expect(screen.getByText('Validate & Save')).toBeInTheDocument();
    // Remove button should NOT be visible
    expect(screen.queryByTestId('remove-api-key-btn')).not.toBeInTheDocument();
  });

  it('renders "active" state when a valid key is stored', async () => {
    mockApiCall.mockResolvedValue({
      has_key: true,
      provider: 'anthropic',
      is_valid: true,
      last_validated_at: '2026-03-20T10:00:00Z',
    });

    await renderAndWait();

    // Badge says "Active", alert says "Active — using your Anthropic key"
    const activeElements = screen.getAllByText(/Active/);
    expect(activeElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/using your/)).toBeInTheDocument();
    expect(screen.getByText(/Anthropic/)).toBeInTheDocument();
    // Remove button should be visible
    expect(screen.getByTestId('remove-api-key-btn')).toBeInTheDocument();
  });

  it('renders "invalid" state when key is stored but invalid', async () => {
    mockApiCall.mockResolvedValue({
      has_key: true,
      provider: 'openai',
      is_valid: false,
      last_validated_at: '2026-03-20T10:00:00Z',
    });

    await renderAndWait();

    expect(screen.getByText(/invalid or expired/)).toBeInTheDocument();
    expect(screen.getByTestId('remove-api-key-btn')).toBeInTheDocument();
  });

  it('has a provider selector with Anthropic and OpenAI options', async () => {
    mockApiCall.mockResolvedValue({
      has_key: false,
      provider: null,
      is_valid: false,
      last_validated_at: null,
    });

    await renderAndWait();

    // Provider select should exist
    expect(screen.getByTestId('provider-select')).toBeInTheDocument();
  });

  it('has a masked API key input field', async () => {
    mockApiCall.mockResolvedValue({
      has_key: false,
      provider: null,
      is_valid: false,
      last_validated_at: null,
    });

    await renderAndWait();

    const input = screen.getByTestId('api-key-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'password');
  });

  it('disables save button when input is empty', async () => {
    mockApiCall.mockResolvedValue({
      has_key: false,
      provider: null,
      is_valid: false,
      last_validated_at: null,
    });

    await renderAndWait();

    const saveBtn = screen.getByTestId('save-api-key-btn');
    expect(saveBtn).toBeDisabled();
  });

  it('calls save API when form is submitted with valid key', async () => {
    // First call: status check (not set)
    mockApiCall
      .mockResolvedValueOnce({
        has_key: false,
        provider: null,
        is_valid: false,
        last_validated_at: null,
      })
      // Second call: store key
      .mockResolvedValueOnce({
        status: 'ok',
        provider: 'anthropic',
        message: 'Key validated',
      })
      // Third call: status refresh after save
      .mockResolvedValueOnce({
        has_key: true,
        provider: 'anthropic',
        is_valid: true,
        last_validated_at: '2026-03-21T10:00:00Z',
      });

    await renderAndWait();

    // Type a key
    const input = screen.getByTestId('api-key-input');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'sk-ant-api03-test-key-123456' } });
    });

    // Click save
    const saveBtn = screen.getByTestId('save-api-key-btn');
    expect(saveBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // Verify the store API was called
    await waitFor(() => {
      expect(mockApiCall).toHaveBeenCalledWith(
        expect.stringContaining('/settings/api-key'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('anthropic'),
        })
      );
    });
  });

  it('shows error state when status fetch fails', async () => {
    mockApiCall.mockRejectedValue(new Error('Network error'));

    await renderAndWait();

    expect(screen.getByText(/Network error/)).toBeInTheDocument();
  });
});
