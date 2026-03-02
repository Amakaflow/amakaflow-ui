import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SortableBlock } from '../SortableBlock';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { Block } from '../../../types/workout';

const block: Block = {
  id: 'block-1',
  label: 'Main Block',
  structure: 'sets',
  exercises: [],
  supersets: [],
};

describe('SortableBlock', () => {
  it('renders the block name', () => {
    render(
      <DndContext>
        <SortableContext items={['block-1']}>
          <SortableBlock
            block={block}
            blockIdx={0}
            onEditExercise={vi.fn()}
            onDeleteExercise={vi.fn()}
            onAddExercise={vi.fn()}
            onAddExerciseToSuperset={vi.fn()}
            onAddSuperset={vi.fn()}
            onDeleteSuperset={vi.fn()}
            onUpdateBlock={vi.fn()}
            onEditBlock={vi.fn()}
            onDeleteBlock={vi.fn()}
          />
        </SortableContext>
      </DndContext>
    );
    expect(screen.getByText('Main Block')).toBeInTheDocument();
  });
});
