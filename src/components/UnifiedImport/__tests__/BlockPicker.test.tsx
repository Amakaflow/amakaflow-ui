import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BlockPicker } from '../BlockPicker';
import type { ProcessedItem, QueueItem, SelectedBlock } from '../../../types/unified-import';

const sources: ProcessedItem[] = [
  {
    queueId: 'a',
    status: 'done',
    workoutTitle: 'Squat Day',
    workout: {
      title: 'Squat Day',
      blocks: [
        { id: 'b1', label: 'Warm-up', exercises: [] },
        { id: 'b2', label: 'Squats', exercises: [] },
      ],
    },
  },
  {
    queueId: 'b',
    status: 'done',
    workoutTitle: 'Push Day',
    workout: {
      title: 'Push Day',
      blocks: [
        { id: 'b3', label: 'Chest', exercises: [] },
        { id: 'b4', label: 'Shoulders', exercises: [] },
      ],
    },
  },
];

const queueItems: QueueItem[] = [
  { id: 'a', type: 'url', label: 'source-a', raw: 'url' },
  { id: 'b', type: 'url', label: 'source-b', raw: 'url' },
];

describe('BlockPicker', () => {
  it('renders block names from all source workouts', () => {
    render(
      <BlockPicker
        queueItems={queueItems}
        processedItems={sources}
        selectedBlocks={[]}
        onSelectionChange={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Warm-up')).toBeInTheDocument();
    expect(screen.getByText('Squats')).toBeInTheDocument();
    expect(screen.getByText('Chest')).toBeInTheDocument();
    expect(screen.getByText('Shoulders')).toBeInTheDocument();
  });

  it('shows workout titles as section headings', () => {
    render(
      <BlockPicker
        queueItems={queueItems}
        processedItems={sources}
        selectedBlocks={[]}
        onSelectionChange={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Squat Day')).toBeInTheDocument();
    expect(screen.getByText('Push Day')).toBeInTheDocument();
  });

  it('calls onSelectionChange with the block when a block is clicked', () => {
    const onSelectionChange = vi.fn();
    render(
      <BlockPicker
        queueItems={queueItems}
        processedItems={sources}
        selectedBlocks={[]}
        onSelectionChange={onSelectionChange}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Warm-up'));
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ blockId: 'b1', blockLabel: 'Warm-up' }),
      ])
    );
  });

  it('deselects a block when clicked again', () => {
    const onSelectionChange = vi.fn();
    render(
      <BlockPicker
        queueItems={queueItems}
        processedItems={sources}
        selectedBlocks={[{ workoutIndex: 0, blockIndex: 0, blockId: 'b1', blockLabel: 'Warm-up' }]}
        onSelectionChange={onSelectionChange}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    // Click the block button in the left column (it's a <button> element)
    const warmupButtons = screen.getAllByText('Warm-up');
    const blockBtn = warmupButtons.find(el => el.tagName === 'BUTTON' || el.closest('button'));
    fireEvent.click(blockBtn!.closest('button') ?? blockBtn!);
    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it('disables confirm button when no blocks selected', () => {
    render(
      <BlockPicker
        queueItems={queueItems}
        processedItems={sources}
        selectedBlocks={[]}
        onSelectionChange={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /save workout/i })).toBeDisabled();
  });

  it('enables confirm button when blocks are selected', () => {
    render(
      <BlockPicker
        queueItems={queueItems}
        processedItems={sources}
        selectedBlocks={[{ workoutIndex: 0, blockIndex: 0, blockId: 'b1', blockLabel: 'Warm-up' }]}
        onSelectionChange={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /save workout/i })).not.toBeDisabled();
  });

  it('calls onCancel when Back is clicked', () => {
    const onCancel = vi.fn();
    render(
      <BlockPicker
        queueItems={queueItems}
        processedItems={sources}
        selectedBlocks={[]}
        onSelectionChange={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows selected block count in the confirm button', () => {
    render(
      <BlockPicker
        queueItems={queueItems}
        processedItems={sources}
        selectedBlocks={[
          { workoutIndex: 0, blockIndex: 0, blockId: 'b1', blockLabel: 'Warm-up' },
          { workoutIndex: 0, blockIndex: 1, blockId: 'b2', blockLabel: 'Squats' },
        ]}
        onSelectionChange={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /save workout.*2 blocks/i })).toBeInTheDocument();
  });

  it('shows selected blocks in the right-column preview', () => {
    render(
      <BlockPicker
        queueItems={queueItems}
        processedItems={sources}
        selectedBlocks={[
          { workoutIndex: 0, blockIndex: 0, blockId: 'b1', blockLabel: 'Warm-up' },
        ]}
        onSelectionChange={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    // Right column shows "Your workout (1 block)"
    expect(screen.getByText(/your workout.*1 block/i)).toBeInTheDocument();
  });

  it('selected panel shows drag handles and remove buttons', () => {
    const selected: SelectedBlock[] = [
      { workoutIndex: 0, blockIndex: 0, blockId: 'b1', blockLabel: 'Warm-up' },
      { workoutIndex: 0, blockIndex: 1, blockId: 'b2', blockLabel: 'Main set' },
    ];

    render(
      <BlockPicker
        queueItems={[]}
        processedItems={[{
          queueId: 'q1', status: 'done', workoutTitle: 'Test',
          workout: { blocks: [
            { id: 'b1', label: 'Warm-up', exercises: [] },
            { id: 'b2', label: 'Main set', exercises: [] },
          ]}
        }]}
        selectedBlocks={selected}
        onSelectionChange={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    // Each selected block has a remove button
    const removeButtons = screen.getAllByRole('button', { name: /remove block/i });
    expect(removeButtons).toHaveLength(2);

    // Each has a drag handle
    const dragHandles = screen.getAllByRole('button', { name: /drag to reorder/i });
    expect(dragHandles).toHaveLength(2);
  });

  it('Add your own block button adds a custom block', async () => {
    const onSelectionChange = vi.fn();
    render(
      <BlockPicker
        queueItems={[]}
        processedItems={[]}
        selectedBlocks={[]}
        onSelectionChange={onSelectionChange}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /add your own block/i }));
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ blockLabel: 'Custom block', workoutIndex: -1 })
      ])
    );
  });
});
