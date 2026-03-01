import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ImportQueue } from '../ImportQueue';
import type { QueueItem } from '../../../types/unified-import';

describe('ImportQueue', () => {
  it('adds a URL to the queue when pasted and button clicked', async () => {
    const onQueueChange = vi.fn();
    const user = userEvent.setup();
    render(<ImportQueue queue={[]} onQueueChange={onQueueChange} />);

    await user.type(screen.getByPlaceholderText(/paste urls/i), 'https://youtube.com/watch?v=abc123');
    await user.click(screen.getByRole('button', { name: /add to queue/i }));

    expect(onQueueChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ type: 'url', label: expect.stringContaining('youtube.com') }),
      ])
    );
  });

  it('parses multiple URLs separated by newlines', async () => {
    const onQueueChange = vi.fn();
    const user = userEvent.setup();
    render(<ImportQueue queue={[]} onQueueChange={onQueueChange} />);

    const textarea = screen.getByPlaceholderText(/paste urls/i);
    await user.click(textarea);
    // Use fireEvent for multi-line input to avoid userEvent newline issues
    fireEvent.change(textarea, {
      target: { value: 'https://youtube.com/a\nhttps://tiktok.com/b' },
    });
    await user.click(screen.getByRole('button', { name: /add to queue/i }));

    expect(onQueueChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ type: 'url' }),
        expect.objectContaining({ type: 'url' }),
      ])
    );
    expect(onQueueChange.mock.calls[0][0]).toHaveLength(2);
  });

  it('removes an item when the remove button is clicked', async () => {
    const item: QueueItem = { id: 'q1', type: 'url', label: 'youtube.com/a', raw: 'https://youtube.com/a' };
    const onQueueChange = vi.fn();
    const user = userEvent.setup();
    render(<ImportQueue queue={[item]} onQueueChange={onQueueChange} />);

    await user.click(screen.getByRole('button', { name: /remove/i }));
    expect(onQueueChange).toHaveBeenCalledWith([]);
  });

  it('shows item count when queue has items', () => {
    const items: QueueItem[] = [
      { id: 'q1', type: 'url', label: 'youtube.com/a', raw: 'https://youtube.com/a' },
      { id: 'q2', type: 'url', label: 'tiktok.com/b', raw: 'https://tiktok.com/b' },
    ];
    render(<ImportQueue queue={items} onQueueChange={vi.fn()} />);
    expect(screen.getByText(/2 items queued/i)).toBeInTheDocument();
  });

  it('disables Add to queue button when textarea is empty', () => {
    render(<ImportQueue queue={[]} onQueueChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /add to queue/i })).toBeDisabled();
  });

  it('clears textarea after adding to queue', async () => {
    const onQueueChange = vi.fn();
    const user = userEvent.setup();
    render(<ImportQueue queue={[]} onQueueChange={onQueueChange} />);

    const textarea = screen.getByPlaceholderText(/paste urls/i);
    await user.type(textarea, 'https://youtube.com/abc');
    await user.click(screen.getByRole('button', { name: /add to queue/i }));

    expect(textarea).toHaveValue('');
  });
});
