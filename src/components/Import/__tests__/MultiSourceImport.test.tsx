import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MultiSourceImport } from '../MultiSourceImport';
import {
  DEMO_QUEUE_ITEMS,
  DEMO_PROCESSED_ITEMS,
} from '../fixtures/multi-source-demo';

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderMultiSource(overrides: Partial<React.ComponentProps<typeof MultiSourceImport>> = {}) {
  const props = {
    onImportComplete: vi.fn(),
    demoQueueItems: DEMO_QUEUE_ITEMS,
    demoProcessedItems: DEMO_PROCESSED_ITEMS,
    ...overrides,
  };
  const result = render(<MultiSourceImport {...props} />);
  return { ...result, props };
}

const SAMPLE_URLS = `https://www.instagram.com/reel/CxMobility01/
https://www.youtube.com/watch?v=StrengthUpper01
https://www.tiktok.com/@hyroxcoach/video/7298765432100`;

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MultiSourceImport', () => {
  describe('rendering', () => {
    it('renders the textarea and import button', () => {
      renderMultiSource();
      expect(screen.getByTestId('multi-source-textarea')).toBeInTheDocument();
      expect(screen.getByTestId('import-all-button')).toBeInTheDocument();
    });

    it('renders the header', () => {
      renderMultiSource();
      expect(screen.getByText('Import from multiple sources')).toBeInTheDocument();
    });
  });

  describe('URL parsing', () => {
    it('detects URLs when pasted into textarea', async () => {
      const user = userEvent.setup();
      renderMultiSource();

      const textarea = screen.getByTestId('multi-source-textarea');
      await user.click(textarea);
      await user.paste(SAMPLE_URLS);

      // Should show 3 URLs detected
      expect(screen.getByText('3 URLs detected')).toBeInTheDocument();
    });

    it('shows platform badges for detected platforms', async () => {
      const user = userEvent.setup();
      renderMultiSource();

      const textarea = screen.getByTestId('multi-source-textarea');
      await user.click(textarea);
      await user.paste(SAMPLE_URLS);

      const badges = screen.getByTestId('platform-badges');
      expect(within(badges).getByText(/Instagram/)).toBeInTheDocument();
      expect(within(badges).getByText(/YouTube/)).toBeInTheDocument();
      expect(within(badges).getByText(/TikTok/)).toBeInTheDocument();
    });

    it('shows URL list with status indicators', async () => {
      const user = userEvent.setup();
      renderMultiSource();

      const textarea = screen.getByTestId('multi-source-textarea');
      await user.click(textarea);
      await user.paste(SAMPLE_URLS);

      const urlList = screen.getByTestId('url-list');
      expect(urlList.children.length).toBe(3);
    });
  });

  describe('URL removal', () => {
    it('can remove a URL from the list', async () => {
      const user = userEvent.setup();
      renderMultiSource();

      const textarea = screen.getByTestId('multi-source-textarea');
      await user.click(textarea);
      await user.paste(SAMPLE_URLS);

      // Remove first URL
      const removeButtons = screen.getAllByLabelText('Remove URL');
      await user.click(removeButtons[0]);

      expect(screen.getByText('2 URLs detected')).toBeInTheDocument();
    });
  });

  describe('import button state', () => {
    it('is disabled when no URLs are entered', () => {
      renderMultiSource();
      const btn = screen.getByTestId('import-all-button');
      expect(btn).toBeDisabled();
    });

    it('is enabled when URLs are present', async () => {
      const user = userEvent.setup();
      renderMultiSource();

      const textarea = screen.getByTestId('multi-source-textarea');
      await user.click(textarea);
      await user.paste(SAMPLE_URLS);

      const btn = screen.getByTestId('import-all-button');
      expect(btn).not.toBeDisabled();
    });
  });

  describe('demo import flow', () => {
    it('shows progress during import', async () => {
      const user = userEvent.setup();
      renderMultiSource();

      const textarea = screen.getByTestId('multi-source-textarea');
      await user.click(textarea);
      await user.paste(SAMPLE_URLS);

      const btn = screen.getByTestId('import-all-button');
      await user.click(btn);

      // Progress indicator should appear
      expect(screen.getByTestId('import-progress')).toBeInTheDocument();
    });
  });
});
