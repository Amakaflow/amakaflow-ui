import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { BlockPicker } from '../BlockPicker';
import {
  DEMO_QUEUE_ITEMS,
  DEMO_PROCESSED_ITEMS,
} from '../fixtures/multi-source-demo';
import type { SelectedBlock } from '../../../types/import';

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderBlockPicker(overrides: Partial<React.ComponentProps<typeof BlockPicker>> = {}) {
  const props = {
    queueItems: DEMO_QUEUE_ITEMS,
    processedItems: DEMO_PROCESSED_ITEMS,
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

describe('BlockPicker multi-source enhancements', () => {
  describe('source badges', () => {
    it('renders platform badges next to workout titles', () => {
      renderBlockPicker();

      // Should show Instagram, YouTube, TikTok badges
      expect(screen.getAllByText('Instagram').length).toBeGreaterThan(0);
      expect(screen.getAllByText('YouTube').length).toBeGreaterThan(0);
      expect(screen.getAllByText('TikTok').length).toBeGreaterThan(0);
    });
  });

  describe('Select All from [Source]', () => {
    it('renders "Select all" buttons when multiple sources present', () => {
      renderBlockPicker();

      const selectAllContainer = screen.getByTestId('select-all-sources');
      expect(within(selectAllContainer).getByText(/Select all from Instagram/)).toBeInTheDocument();
      expect(within(selectAllContainer).getByText(/Select all from YouTube/)).toBeInTheDocument();
      expect(within(selectAllContainer).getByText(/Select all from TikTok/)).toBeInTheDocument();
    });

    it('selects all blocks from Instagram when clicked', async () => {
      const user = userEvent.setup();
      const { props } = renderBlockPicker();

      const btn = screen.getByText(/Select all from Instagram/);
      await user.click(btn);

      // Should call onSelectionChange with Instagram blocks
      expect(props.onSelectionChange).toHaveBeenCalledTimes(1);
      const selected = props.onSelectionChange.mock.calls[0][0] as SelectedBlock[];

      // Instagram has 3 blocks total (2 from first reel, 1 from second)
      expect(selected.length).toBe(3);
      expect(selected.every(s => s.blockId.startsWith('ig'))).toBe(true);
    });

    it('selects all blocks from YouTube when clicked', async () => {
      const user = userEvent.setup();
      const { props } = renderBlockPicker();

      const btn = screen.getByText(/Select all from YouTube/);
      await user.click(btn);

      const selected = props.onSelectionChange.mock.calls[0][0] as SelectedBlock[];
      // YouTube has 4 blocks (2 per video x 2 videos)
      expect(selected.length).toBe(4);
      expect(selected.every(s => s.blockId.startsWith('yt'))).toBe(true);
    });

    it('selects all blocks from TikTok when clicked', async () => {
      const user = userEvent.setup();
      const { props } = renderBlockPicker();

      const btn = screen.getByText(/Select all from TikTok/);
      await user.click(btn);

      const selected = props.onSelectionChange.mock.calls[0][0] as SelectedBlock[];
      // TikTok has 1 block
      expect(selected.length).toBe(1);
      expect(selected[0].blockId).toBe('tt1-block-1');
    });

    it('does not re-add already selected blocks', async () => {
      const user = userEvent.setup();
      const alreadySelected: SelectedBlock[] = [
        { workoutIndex: 0, blockIndex: 0, blockId: 'ig1-block-1', blockLabel: 'Hip & Ankle Mobility' },
      ];
      const { props } = renderBlockPicker({ selectedBlocks: alreadySelected });

      const btn = screen.getByText(/Select all from Instagram/);
      await user.click(btn);

      const selected = props.onSelectionChange.mock.calls[0][0] as SelectedBlock[];
      // Should have 3 total (1 existing + 2 new) not 4
      expect(selected.length).toBe(3);
      // The already-selected one should still be at index 0
      expect(selected[0].blockId).toBe('ig1-block-1');
    });
  });

  describe('block color coding', () => {
    it('does not render "Select all" buttons when only one source', () => {
      // Use only Instagram items
      const instagramOnly = DEMO_PROCESSED_ITEMS.filter(
        p => p.sourceIcon === 'instagram'
      );
      renderBlockPicker({ processedItems: instagramOnly });

      expect(screen.queryByTestId('select-all-sources')).not.toBeInTheDocument();
    });
  });

  describe('block picker data-testid', () => {
    it('has data-testid on root element', () => {
      renderBlockPicker();
      expect(screen.getByTestId('block-picker')).toBeInTheDocument();
    });
  });
});
