import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BlockPicker } from '../BlockPicker';
import type { ProcessedItem, QueueItem, SelectedBlock } from '../../../types/import';

// ── Test data ────────────────────────────────────────────────────────────────

const QUEUE_ITEMS: QueueItem[] = [
  { id: 'q1', type: 'url', label: 'push-day', raw: 'https://example.com/push' },
  { id: 'q2', type: 'url', label: 'pull-day', raw: 'https://example.com/pull' },
];

function makeProcessedItems(): ProcessedItem[] {
  return [
    {
      queueId: 'q1',
      status: 'done',
      workoutTitle: 'Push Day',
      workout: {
        title: 'Push Day',
        blocks: [
          {
            id: 'block-1',
            label: 'Horizontal Push',
            exercises: [
              { id: 'ex-1', name: 'Bench Press', sets: 4, reps: 8 },
              { id: 'ex-2', name: 'Incline DB Press', sets: 3, reps: 10 },
            ],
          },
          {
            id: 'block-2',
            label: 'Vertical Push',
            exercises: [
              { id: 'ex-3', name: 'Overhead Press', sets: 3, reps: 8 },
              { id: 'ex-4', name: 'Lateral Raise', sets: 3, reps: 15 },
              { id: 'ex-5', name: 'Tricep Pushdown', sets: 3, reps: 12 },
              { id: 'ex-6', name: 'Cable Fly', sets: 3, reps: 15 },
            ],
          },
        ],
      },
    },
    {
      queueId: 'q2',
      status: 'done',
      workoutTitle: 'Pull Day',
      workout: {
        title: 'Pull Day',
        blocks: [
          {
            id: 'block-3',
            label: 'Back',
            exercises: [
              { id: 'ex-7', name: 'Pull-ups', sets: 4, reps: 8 },
            ],
          },
        ],
      },
    },
  ];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderBlockPicker(overrides: Partial<React.ComponentProps<typeof BlockPicker>> = {}) {
  const props = {
    queueItems: QUEUE_ITEMS,
    processedItems: makeProcessedItems(),
    selectedBlocks: [] as SelectedBlock[],
    onSelectionChange: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  const result = render(<BlockPicker {...props} />);
  return { ...result, props };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BlockPicker', () => {
  // ── Exercise name subtitles ─────────────────────────────────────────────

  describe('exercise name subtitles (always visible)', () => {
    it('shows first 2-3 exercise names as subtitle text', () => {
      renderBlockPicker();
      // "Horizontal Push" block has 2 exercises: Bench Press, Incline DB Press
      expect(screen.getByText(/Bench Press · Incline DB Press/)).toBeInTheDocument();
    });

    it('shows "+N more" when block has more than 3 exercises', () => {
      renderBlockPicker();
      // "Vertical Push" has 4 exercises, first 3 shown + "+1 more"
      expect(screen.getByText(/Overhead Press · Lateral Raise · Tricep Pushdown/)).toBeInTheDocument();
      expect(screen.getByText(/\+1 more/)).toBeInTheDocument();
    });

    it('shows single exercise name for 1-exercise block', () => {
      renderBlockPicker();
      // "Back" block has 1 exercise
      expect(screen.getByText('Pull-ups')).toBeInTheDocument();
    });
  });

  // ── Chevron expand/collapse ─────────────────────────────────────────────

  describe('chevron expand/collapse', () => {
    it('renders expand buttons for blocks with exercises', () => {
      renderBlockPicker();
      const expandButtons = screen.getAllByLabelText('Expand exercises');
      expect(expandButtons.length).toBe(3); // 3 blocks with exercises
    });

    it('expands block to show full exercise list with sets/reps on click', async () => {
      const user = userEvent.setup();
      renderBlockPicker();

      // Click first expand button
      const expandButtons = screen.getAllByLabelText('Expand exercises');
      await user.click(expandButtons[0]);

      // Should now show exercises with sets x reps
      expect(screen.getByText('Bench Press')).toBeInTheDocument();
      expect(screen.getByText('4×8')).toBeInTheDocument();
      expect(screen.getByText('Incline DB Press')).toBeInTheDocument();
      expect(screen.getByText('3×10')).toBeInTheDocument();
    });

    it('hides subtitle text when expanded', async () => {
      const user = userEvent.setup();
      renderBlockPicker();

      // Before expand: subtitle visible
      expect(screen.getByText(/Bench Press · Incline DB Press/)).toBeInTheDocument();

      // Expand
      const expandButtons = screen.getAllByLabelText('Expand exercises');
      await user.click(expandButtons[0]);

      // After expand: subtitle should be gone (replaced by full list)
      expect(screen.queryByText(/Bench Press · Incline DB Press/)).not.toBeInTheDocument();
    });

    it('collapses back on second click', async () => {
      const user = userEvent.setup();
      renderBlockPicker();

      const expandButtons = screen.getAllByLabelText('Expand exercises');
      await user.click(expandButtons[0]);

      // Should show collapse label
      const collapseBtn = screen.getByLabelText('Collapse exercises');
      await user.click(collapseBtn);

      // Subtitle should reappear
      expect(screen.getByText(/Bench Press · Incline DB Press/)).toBeInTheDocument();
    });
  });

  // ── Expand does NOT toggle selection ────────────────────────────────────

  describe('expand/select independence', () => {
    it('clicking chevron does not call onSelectionChange', async () => {
      const user = userEvent.setup();
      const { props } = renderBlockPicker();

      const expandButtons = screen.getAllByLabelText('Expand exercises');
      await user.click(expandButtons[0]);

      expect(props.onSelectionChange).not.toHaveBeenCalled();
    });

    it('clicking block label still toggles selection', async () => {
      const user = userEvent.setup();
      const { props } = renderBlockPicker();

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);

      expect(props.onSelectionChange).toHaveBeenCalledTimes(1);
      expect(props.onSelectionChange).toHaveBeenCalledWith([
        expect.objectContaining({ blockId: 'block-1', blockLabel: 'Horizontal Push' }),
      ]);
    });

    it('can expand and select independently', async () => {
      const user = userEvent.setup();
      const { props } = renderBlockPicker();

      // Expand first block
      const expandButtons = screen.getAllByLabelText('Expand exercises');
      await user.click(expandButtons[0]);

      // Select first block
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);

      // Expand should not trigger selection, selection should work normally
      expect(props.onSelectionChange).toHaveBeenCalledTimes(1);
    });
  });

  // ── Exercise count badge ───────────────────────────────────────────────

  describe('exercise count badge', () => {
    it('displays exercise count (e.g. "2 ex.")', () => {
      renderBlockPicker();
      expect(screen.getByText('2 ex.')).toBeInTheDocument();
      expect(screen.getByText('4 ex.')).toBeInTheDocument();
      expect(screen.getByText('1 ex.')).toBeInTheDocument();
    });
  });

  // ── Selection state ────────────────────────────────────────────────────

  describe('selection state', () => {
    it('shows selected blocks in "Your workout" panel', () => {
      const selected: SelectedBlock[] = [
        { workoutIndex: 0, blockIndex: 0, blockId: 'block-1', blockLabel: 'Horizontal Push' },
      ];
      renderBlockPicker({ selectedBlocks: selected });

      expect(screen.getByText('Your workout (1 block)')).toBeInTheDocument();
    });

    it('shows empty state when no blocks selected', () => {
      renderBlockPicker({ selectedBlocks: [] });
      expect(screen.getByText(/Select blocks on the left/)).toBeInTheDocument();
    });
  });

  // ── Buttons ────────────────────────────────────────────────────────────

  describe('confirm and cancel', () => {
    it('disables Save button when no blocks selected', () => {
      renderBlockPicker({ selectedBlocks: [] });
      const saveBtn = screen.getByRole('button', { name: /Save workout/ });
      expect(saveBtn).toBeDisabled();
    });

    it('enables Save button when blocks are selected', () => {
      const selected: SelectedBlock[] = [
        { workoutIndex: 0, blockIndex: 0, blockId: 'block-1', blockLabel: 'Horizontal Push' },
      ];
      renderBlockPicker({ selectedBlocks: selected });
      const saveBtn = screen.getByRole('button', { name: /Save workout/ });
      expect(saveBtn).not.toBeDisabled();
    });

    it('calls onCancel when Back is clicked', async () => {
      const user = userEvent.setup();
      const { props } = renderBlockPicker();
      await user.click(screen.getByRole('button', { name: 'Back' }));
      expect(props.onCancel).toHaveBeenCalled();
    });
  });
});
