import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { SortableBlock } from '../StructureWorkout/SortableBlock';
import type { Block } from '../../types/workout';

const block: Block = {
  id: 'block-1',
  label: 'Morning Circuit',
  structure: 'circuit',
  rounds: 3,
  rest_between_rounds_sec: 60,
  exercises: [],
};

function defaultProps(overrides: Partial<Parameters<typeof SortableBlock>[0]> = {}) {
  return {
    block,
    blockIdx: 0,
    onEditExercise: vi.fn(),
    onDeleteExercise: vi.fn(),
    onAddExercise: vi.fn(),
    onAddExerciseToSuperset: vi.fn(),
    onAddSuperset: vi.fn(),
    onDeleteSuperset: vi.fn(),
    onUpdateBlock: vi.fn(),
    onEditBlock: vi.fn(),
    onDeleteBlock: vi.fn(),
    ...overrides,
  };
}

function renderBlock(overrides: Partial<Parameters<typeof SortableBlock>[0]> = {}) {
  const props = defaultProps(overrides);
  render(
    <DndContext>
      <SortableContext items={['block-1']}>
        <SortableBlock {...props} />
      </SortableContext>
    </DndContext>
  );
  return props;
}

describe('DraggableBlock', () => {
  it('renders workout title', () => {
    renderBlock();
    expect(screen.getByText('Morning Circuit')).toBeInTheDocument();
  });

  it('config row is hidden initially', () => {
    renderBlock();
    // BlockConfigRow renders Rounds/Work/Time Cap labels; none should be visible
    // when the block is collapsed (isCollapsed=true by default)
    expect(screen.queryByText('Rounds')).not.toBeInTheDocument();
  });
});
