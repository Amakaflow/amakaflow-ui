import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResultsScreen } from '../ResultsScreen';
import type { ProcessedItem, QueueItem } from '../../../types/unified-import';

const makeItem = (id: string, title: string): ProcessedItem => ({
  queueId: id,
  status: 'done',
  workoutTitle: title,
  blockCount: 2,
  exerciseCount: 6,
  workout: { title, blocks: [] },
});

const makeQueue = (ids: string[]): QueueItem[] =>
  ids.map(id => ({ id, type: 'url' as const, label: id, raw: id }));

describe('ResultsScreen', () => {
  it('renders one card per done item', () => {
    render(
      <ResultsScreen
        queueItems={makeQueue(['a', 'b'])}
        processedItems={[makeItem('a', 'Push Day'), makeItem('b', 'Pull Day')]}
        onSaveAll={vi.fn()}
        onBuildOne={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText('Push Day')).toBeInTheDocument();
    expect(screen.getByText('Pull Day')).toBeInTheDocument();
  });

  it('shows Build one workout button only when 2+ results', () => {
    const { rerender } = render(
      <ResultsScreen
        queueItems={makeQueue(['a'])}
        processedItems={[makeItem('a', 'Solo Day')]}
        onSaveAll={vi.fn()}
        onBuildOne={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /build one workout/i })).not.toBeInTheDocument();

    rerender(
      <ResultsScreen
        queueItems={makeQueue(['a', 'b'])}
        processedItems={[makeItem('a', 'A'), makeItem('b', 'B')]}
        onSaveAll={vi.fn()}
        onBuildOne={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /build one workout/i })).toBeInTheDocument();
  });

  it('calls onRemove when remove button is clicked', () => {
    const onRemove = vi.fn();
    render(
      <ResultsScreen
        queueItems={makeQueue(['a'])}
        processedItems={[makeItem('a', 'Push Day')]}
        onSaveAll={vi.fn()}
        onBuildOne={vi.fn()}
        onEdit={vi.fn()}
        onRemove={onRemove}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(onRemove).toHaveBeenCalledWith('a');
  });

  it('calls onEdit when Edit button is clicked', () => {
    const onEdit = vi.fn();
    render(
      <ResultsScreen
        queueItems={makeQueue(['a'])}
        processedItems={[makeItem('a', 'Push Day')]}
        onSaveAll={vi.fn()}
        onBuildOne={vi.fn()}
        onEdit={onEdit}
        onRemove={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith('a');
  });

  it('calls onSaveAll when Save all button is clicked', () => {
    const onSaveAll = vi.fn();
    render(
      <ResultsScreen
        queueItems={makeQueue(['a'])}
        processedItems={[makeItem('a', 'Push Day')]}
        onSaveAll={onSaveAll}
        onBuildOne={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /save all/i }));
    expect(onSaveAll).toHaveBeenCalled();
  });

  it('shows failed item count when some items failed', () => {
    render(
      <ResultsScreen
        queueItems={makeQueue(['a', 'b'])}
        processedItems={[
          makeItem('a', 'Push Day'),
          { queueId: 'b', status: 'failed', errorMessage: 'timeout' },
        ]}
        onSaveAll={vi.fn()}
        onBuildOne={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText(/1 item.*failed/i)).toBeInTheDocument();
  });

  it('disables Save all button when no done items', () => {
    render(
      <ResultsScreen
        queueItems={makeQueue(['a'])}
        processedItems={[{ queueId: 'a', status: 'failed' }]}
        onSaveAll={vi.fn()}
        onBuildOne={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /save all/i })).toBeDisabled();
  });

  it('shows block and exercise counts on each card', () => {
    render(
      <ResultsScreen
        queueItems={makeQueue(['a'])}
        processedItems={[makeItem('a', 'Push Day')]}
        onSaveAll={vi.fn()}
        onBuildOne={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText(/2 blocks/i)).toBeInTheDocument();
    expect(screen.getByText(/6 exercises/i)).toBeInTheDocument();
  });

  it('Expand button shows block list for that workout', async () => {
    const mockProcessed: ProcessedItem[] = [{
      queueId: 'q1',
      status: 'done',
      workoutTitle: 'Push Day',
      blockCount: 2,
      exerciseCount: 6,
      workout: {
        blocks: [
          { id: 'b1', label: 'Warm-up', exercises: [{}, {}] },
          { id: 'b2', label: 'Main set', exercises: [{}, {}, {}, {}] },
        ]
      }
    }];
    const mockQueue: QueueItem[] = [{ id: 'q1', type: 'url', label: 'youtube.com/...', raw: 'https://youtube.com' }];

    render(
      <ResultsScreen
        queueItems={mockQueue}
        processedItems={mockProcessed}
        onSaveAll={vi.fn()}
        onBuildOne={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    // Block list not visible initially
    expect(screen.queryByText('Warm-up')).not.toBeInTheDocument();

    // Click expand
    fireEvent.click(screen.getByRole('button', { name: /expand/i }));

    // Block list now visible
    expect(screen.getByText('Warm-up')).toBeInTheDocument();
    expect(screen.getByText('Main set')).toBeInTheDocument();

    // Click collapse — block list disappears again
    fireEvent.click(screen.getByRole('button', { name: /collapse/i }));
    expect(screen.queryByText('Warm-up')).not.toBeInTheDocument();
  });
});
