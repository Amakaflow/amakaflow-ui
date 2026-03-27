import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImportQueue } from '../ImportQueue';
import type { QueueItem } from '../../../types/import';

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderQueue(queue: QueueItem[] = [], onQueueChange = vi.fn()) {
  return { onQueueChange, ...render(<ImportQueue queue={queue} onQueueChange={onQueueChange} />) };
}

// ── Mock clipboard API ──────────────────────────────────────────────────────

let clipboardReadText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  clipboardReadText = vi.fn().mockResolvedValue('');
  Object.defineProperty(navigator, 'clipboard', {
    value: { readText: clipboardReadText },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ImportQueue', () => {
  // ── Rendering ──────────────────────────────────────────────────────────────

  it('renders the URL textarea', () => {
    renderQueue();
    expect(screen.getByPlaceholderText(/paste urls here/i)).toBeInTheDocument();
  });

  it('renders Add to queue button (disabled when empty)', () => {
    renderQueue();
    const addBtn = screen.getByRole('button', { name: /add to queue/i });
    expect(addBtn).toBeInTheDocument();
    expect(addBtn).toBeDisabled();
  });

  it('renders Paste from clipboard button when navigator.clipboard is available', () => {
    renderQueue();
    expect(screen.getByRole('button', { name: /paste from clipboard/i })).toBeInTheDocument();
  });

  // ── Manual add flow ────────────────────────────────────────────────────────

  it('enables Add to queue when textarea has content', async () => {
    const user = userEvent.setup();
    renderQueue();
    const textarea = screen.getByPlaceholderText(/paste urls here/i);
    await user.type(textarea, 'https://example.com');
    expect(screen.getByRole('button', { name: /add to queue/i })).toBeEnabled();
  });

  it('calls onQueueChange with new URL items when Add to queue is clicked', async () => {
    const user = userEvent.setup();
    const { onQueueChange } = renderQueue();
    const textarea = screen.getByPlaceholderText(/paste urls here/i);
    await user.type(textarea, 'https://example.com');
    await user.click(screen.getByRole('button', { name: /add to queue/i }));
    expect(onQueueChange).toHaveBeenCalledTimes(1);
    const items = onQueueChange.mock.calls[0][0] as QueueItem[];
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('url');
    expect(items[0].raw).toBe('https://example.com');
  });

  // ── Auto-add on paste ─────────────────────────────────────────────────────

  it('auto-adds URLs to queue when pasting content that starts with http', () => {
    const { onQueueChange } = renderQueue();
    const textarea = screen.getByPlaceholderText(/paste urls here/i);

    fireEvent.paste(textarea, {
      clipboardData: { getData: () => 'https://youtube.com/watch?v=abc' },
    });

    expect(onQueueChange).toHaveBeenCalledTimes(1);
    const items = onQueueChange.mock.calls[0][0] as QueueItem[];
    expect(items).toHaveLength(1);
    expect(items[0].raw).toBe('https://youtube.com/watch?v=abc');
    expect(items[0].type).toBe('url');
  });

  it('auto-adds multiple URLs separated by newlines on paste', () => {
    const { onQueueChange } = renderQueue();
    const textarea = screen.getByPlaceholderText(/paste urls here/i);

    fireEvent.paste(textarea, {
      clipboardData: { getData: () => 'https://a.com\nhttps://b.com' },
    });

    expect(onQueueChange).toHaveBeenCalledTimes(1);
    const items = onQueueChange.mock.calls[0][0] as QueueItem[];
    expect(items).toHaveLength(2);
    expect(items[0].raw).toBe('https://a.com');
    expect(items[1].raw).toBe('https://b.com');
  });

  it('does NOT auto-add when pasted text does not start with http', () => {
    const { onQueueChange } = renderQueue();
    const textarea = screen.getByPlaceholderText(/paste urls here/i);

    fireEvent.paste(textarea, {
      clipboardData: { getData: () => 'just some random text' },
    });

    expect(onQueueChange).not.toHaveBeenCalled();
  });

  it('appends pasted URLs to existing queue items', () => {
    const existing: QueueItem[] = [
      { id: 'existing-1', type: 'url', label: 'old.com', raw: 'https://old.com' },
    ];
    const { onQueueChange } = renderQueue(existing);
    const textarea = screen.getByPlaceholderText(/paste urls here/i);

    fireEvent.paste(textarea, {
      clipboardData: { getData: () => 'https://new.com' },
    });

    expect(onQueueChange).toHaveBeenCalledTimes(1);
    const items = onQueueChange.mock.calls[0][0] as QueueItem[];
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe('existing-1');
    expect(items[1].raw).toBe('https://new.com');
  });

  // ── Paste from clipboard button ───────────────────────────────────────────

  it('reads clipboard and adds URLs when Paste from clipboard is clicked', async () => {
    clipboardReadText.mockResolvedValue('https://clipboard-url.com');

    const { onQueueChange } = renderQueue();
    const btn = screen.getByRole('button', { name: /paste from clipboard/i });

    // Use fireEvent for synchronous click, then flush promises
    fireEvent.click(btn);

    // Flush the microtask queue so the async pasteFromClipboard resolves
    await new Promise(r => setTimeout(r, 50));

    expect(clipboardReadText).toHaveBeenCalledTimes(1);
    expect(onQueueChange).toHaveBeenCalledTimes(1);

    const items = onQueueChange.mock.calls[0][0] as QueueItem[];
    expect(items).toHaveLength(1);
    expect(items[0].raw).toBe('https://clipboard-url.com');
  });

  it('silently handles clipboard permission denial', async () => {
    const user = userEvent.setup();
    clipboardReadText.mockRejectedValue(new Error('Permission denied'));

    const { onQueueChange } = renderQueue();
    await user.click(screen.getByRole('button', { name: /paste from clipboard/i }));

    // Give the rejected promise time to settle, then verify no crash and no queue change
    await new Promise(r => setTimeout(r, 50));
    expect(onQueueChange).not.toHaveBeenCalled();
  });

  it('does nothing when clipboard returns empty string', async () => {
    const user = userEvent.setup();
    clipboardReadText.mockResolvedValue('   ');

    const { onQueueChange } = renderQueue();
    await user.click(screen.getByRole('button', { name: /paste from clipboard/i }));

    await new Promise(r => setTimeout(r, 50));
    expect(onQueueChange).not.toHaveBeenCalled();
  });

  // ── Queue item display & removal ──────────────────────────────────────────

  it('displays queued items with remove buttons', () => {
    const items: QueueItem[] = [
      { id: '1', type: 'url', label: 'example.com/page', raw: 'https://example.com/page' },
      { id: '2', type: 'url', label: 'other.com/path', raw: 'https://other.com/path' },
    ];
    renderQueue(items);
    expect(screen.getByText('example.com/page')).toBeInTheDocument();
    expect(screen.getByText('other.com/path')).toBeInTheDocument();
    expect(screen.getByText('2 items queued')).toBeInTheDocument();
  });

  it('calls onQueueChange without the removed item when remove is clicked', async () => {
    const user = userEvent.setup();
    const items: QueueItem[] = [
      { id: '1', type: 'url', label: 'example.com', raw: 'https://example.com' },
      { id: '2', type: 'url', label: 'other.com', raw: 'https://other.com' },
    ];
    const { onQueueChange } = renderQueue(items);
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await user.click(removeButtons[0]);

    expect(onQueueChange).toHaveBeenCalledTimes(1);
    const remaining = onQueueChange.mock.calls[0][0] as QueueItem[];
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('2');
  });

  it('shows singular "item" for a single queued item', () => {
    const items: QueueItem[] = [
      { id: '1', type: 'url', label: 'one.com', raw: 'https://one.com' },
    ];
    renderQueue(items);
    expect(screen.getByText('1 item queued')).toBeInTheDocument();
  });
});
