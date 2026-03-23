import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { FollowAlongMergePlayer, type MergedBlock } from '../FollowAlongMergePlayer';

// ── Test data ────────────────────────────────────────────────────────────────

const DEMO_BLOCKS: MergedBlock[] = [
  {
    id: 'block-1',
    label: 'Hip Mobility',
    sourcePlatform: 'instagram',
    sourceUrl: 'https://www.instagram.com/reel/CxMobility01/',
    videoSegment: { url: 'https://www.instagram.com/reel/CxMobility01/', platform: 'instagram', startSec: 0, endSec: 45 },
    exercises: [
      { name: '90/90 Hip Switch', sets: 2, reps: '8 each' },
      { name: 'World\'s Greatest Stretch', sets: 2, reps: '5 each' },
    ],
  },
  {
    id: 'block-2',
    label: 'Push Superset',
    sourcePlatform: 'youtube',
    sourceUrl: 'https://www.youtube.com/watch?v=StrengthUpper01',
    videoSegment: { url: 'https://www.youtube.com/watch?v=StrengthUpper01', platform: 'youtube', startSec: 0, endSec: 300 },
    exercises: [
      { name: 'Bench Press', sets: 4, reps: 6 },
      { name: 'Overhead Press', sets: 4, reps: 8 },
    ],
  },
  {
    id: 'block-3',
    label: 'HYROX Station',
    sourcePlatform: 'tiktok',
    sourceUrl: 'https://www.tiktok.com/@hyroxcoach/video/123',
    videoSegment: { url: 'https://www.tiktok.com/@hyroxcoach/video/123', platform: 'tiktok', startSec: 0, endSec: 55 },
    exercises: [
      { name: 'Sled Push', sets: 4, duration_sec: 60 },
      { name: 'Wall Balls', sets: 4, reps: 20 },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderPlayer(overrides: Partial<React.ComponentProps<typeof FollowAlongMergePlayer>> = {}) {
  const props = {
    workoutTitle: 'Mixed Source Workout',
    blocks: DEMO_BLOCKS,
    onClose: vi.fn(),
    ...overrides,
  };
  const result = render(<FollowAlongMergePlayer {...props} />);
  return { ...result, props };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('FollowAlongMergePlayer', () => {
  describe('rendering', () => {
    it('renders the player with workout title', () => {
      renderPlayer();
      expect(screen.getByText('Mixed Source Workout')).toBeInTheDocument();
    });

    it('shows block counter', () => {
      renderPlayer();
      expect(screen.getByText('Block 1 of 3')).toBeInTheDocument();
    });

    it('shows the data-testid', () => {
      renderPlayer();
      expect(screen.getByTestId('follow-along-player')).toBeInTheDocument();
    });
  });

  describe('first block display', () => {
    it('shows the first block label', () => {
      renderPlayer();
      expect(screen.getAllByText('Hip Mobility').length).toBeGreaterThanOrEqual(1);
    });

    it('shows Instagram badge for the first block', () => {
      renderPlayer();
      expect(screen.getByText('Instagram')).toBeInTheDocument();
    });

    it('shows exercises of the current block', () => {
      renderPlayer();
      expect(screen.getByText('90/90 Hip Switch')).toBeInTheDocument();
      expect(screen.getByText("World's Greatest Stretch")).toBeInTheDocument();
    });

    it('shows video timestamp', () => {
      renderPlayer();
      expect(screen.getByText('0:00 - 0:45')).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('disables Prev button on first block', () => {
      renderPlayer();
      const prevBtn = screen.getByRole('button', { name: /Prev/ });
      expect(prevBtn).toBeDisabled();
    });

    it('navigates to next block on Next click', async () => {
      const user = userEvent.setup();
      renderPlayer();

      await user.click(screen.getByRole('button', { name: /Next/ }));

      // Should now show block 2
      expect(screen.getByText('Block 2 of 3')).toBeInTheDocument();
      expect(screen.getAllByText('Push Superset').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('YouTube')).toBeInTheDocument();
    });

    it('navigates to previous block on Prev click', async () => {
      const user = userEvent.setup();
      renderPlayer();

      // Go to block 2
      await user.click(screen.getByRole('button', { name: /Next/ }));
      expect(screen.getByText('Block 2 of 3')).toBeInTheDocument();

      // Go back to block 1
      await user.click(screen.getByRole('button', { name: /Prev/ }));
      expect(screen.getByText('Block 1 of 3')).toBeInTheDocument();
    });

    it('disables Next button on last block', async () => {
      const user = userEvent.setup();
      renderPlayer();

      await user.click(screen.getByRole('button', { name: /Next/ }));
      await user.click(screen.getByRole('button', { name: /Next/ }));

      const nextBtn = screen.getByRole('button', { name: /Next/ });
      expect(nextBtn).toBeDisabled();
    });
  });

  describe('block timeline', () => {
    it('renders timeline with all blocks', () => {
      renderPlayer();
      const timeline = screen.getByTestId('block-timeline');
      expect(timeline.children.length).toBe(3);
    });

    it('clicking a timeline block navigates to it', async () => {
      const user = userEvent.setup();
      renderPlayer();

      const timeline = screen.getByTestId('block-timeline');
      const thirdBlock = timeline.children[2] as HTMLElement;
      await user.click(thirdBlock);

      expect(screen.getByText('Block 3 of 3')).toBeInTheDocument();
      expect(screen.getAllByText('HYROX Station').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('TikTok')).toBeInTheDocument();
    });
  });

  describe('playback controls', () => {
    it('toggles play/pause', async () => {
      const user = userEvent.setup();
      renderPlayer();

      // Initially shows Play buttons (center overlay + control bar)
      const playBtns = screen.getAllByRole('button', { name: 'Play' });
      expect(playBtns.length).toBeGreaterThanOrEqual(1);

      // Click the center play button (first one)
      await user.click(playBtns[0]);

      // Now should show Pause
      const pauseBtns = screen.getAllByRole('button', { name: 'Pause' });
      expect(pauseBtns.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('source link', () => {
    it('shows "Open in Instagram" link for first block', () => {
      renderPlayer();
      expect(screen.getByText(/Open in Instagram/)).toBeInTheDocument();
    });

    it('shows correct platform link after navigating', async () => {
      const user = userEvent.setup();
      renderPlayer();

      await user.click(screen.getByRole('button', { name: /Next/ }));
      expect(screen.getByText(/Open in YouTube/)).toBeInTheDocument();
    });
  });

  describe('close button', () => {
    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const { props } = renderPlayer();

      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });
  });
});
