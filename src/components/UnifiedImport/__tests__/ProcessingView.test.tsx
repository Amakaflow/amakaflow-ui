import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessingView } from '../ProcessingView';
import type { QueueItem, ProcessedItem } from '../../../types/unified-import';

const makeQueue = (count: number): QueueItem[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `q${i}`,
    type: 'url' as const,
    label: `source-${i}`,
    raw: `https://example.com/${i}`,
  }));

describe('ProcessingView', () => {
  it('renders a row for each queued item', () => {
    const queue = makeQueue(3);
    render(<ProcessingView queueItems={queue} processedItems={[]} onRetry={vi.fn()} />);
    expect(screen.getByText('source-0')).toBeInTheDocument();
    expect(screen.getByText('source-1')).toBeInTheDocument();
    expect(screen.getByText('source-2')).toBeInTheDocument();
  });

  it('shows Pending badge for items with no processed entry', () => {
    const queue = makeQueue(1);
    render(<ProcessingView queueItems={queue} processedItems={[]} onRetry={vi.fn()} />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows Processing badge for detecting/extracting status', () => {
    const queue = makeQueue(1);
    const processed: ProcessedItem[] = [{ queueId: 'q0', status: 'detecting' }];
    render(<ProcessingView queueItems={queue} processedItems={processed} onRetry={vi.fn()} />);
    expect(screen.getByText('Processing')).toBeInTheDocument();
  });

  it('shows Done badge for completed items', () => {
    const queue = makeQueue(1);
    const processed: ProcessedItem[] = [{ queueId: 'q0', status: 'done', workoutTitle: 'Push Day' }];
    render(<ProcessingView queueItems={queue} processedItems={processed} onRetry={vi.fn()} />);
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('shows Retry button for failed items', () => {
    const queue = makeQueue(1);
    const processed: ProcessedItem[] = [{ queueId: 'q0', status: 'failed', errorMessage: 'timeout' }];
    render(<ProcessingView queueItems={queue} processedItems={processed} onRetry={vi.fn()} />);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls onRetry with the correct queueId when Retry clicked', () => {
    const onRetry = vi.fn();
    const queue = makeQueue(1);
    const processed: ProcessedItem[] = [{ queueId: 'q0', status: 'failed' }];
    render(<ProcessingView queueItems={queue} processedItems={processed} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledWith('q0');
  });

  it('shows item count in the heading', () => {
    render(<ProcessingView queueItems={makeQueue(4)} processedItems={[]} onRetry={vi.fn()} />);
    expect(screen.getByText(/processing 4 items/i)).toBeInTheDocument();
  });
});
