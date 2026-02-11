/**
 * Tests for supportsAutoExtraction() and addSource() routing logic.
 *
 * Covers:
 * - Instagram + autoExtract ON -> true (goes to sources list)
 * - Instagram + autoExtract OFF -> false (opens VideoIngestDialog)
 * - YouTube -> always true
 * - TikTok -> always true
 * - Pinterest -> always true
 * - Unknown platform -> false
 *
 * AMA-564: Instagram Apify auto-extraction routing.
 */

import { describe, it, expect, vi } from 'vitest';

// We need to test supportsAutoExtraction directly from video-api
// Mock the authenticated-fetch and config modules
vi.mock('../authenticated-fetch', () => ({
  authenticatedFetch: vi.fn(),
}));

vi.mock('../config', () => ({
  API_URLS: { FOLLOW_ALONG: 'http://test', INGESTOR: 'http://test' },
}));

// Import after mocks are set up
import { supportsAutoExtraction } from '../video-api';

describe('supportsAutoExtraction', () => {
  // ---------------------------------------------------------------------------
  // Instagram routing
  // ---------------------------------------------------------------------------

  describe('instagram platform', () => {
    it('should return true when instagramAutoExtract is true', () => {
      expect(supportsAutoExtraction('instagram', true)).toBe(true);
    });

    it('should return false when instagramAutoExtract is false', () => {
      expect(supportsAutoExtraction('instagram', false)).toBe(false);
    });

    it('should return false when instagramAutoExtract is not provided (defaults to false)', () => {
      expect(supportsAutoExtraction('instagram')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Other platforms (always auto-extract)
  // ---------------------------------------------------------------------------

  describe('youtube platform', () => {
    it('should always return true regardless of instagramAutoExtract', () => {
      expect(supportsAutoExtraction('youtube', false)).toBe(true);
      expect(supportsAutoExtraction('youtube', true)).toBe(true);
      expect(supportsAutoExtraction('youtube')).toBe(true);
    });
  });

  describe('tiktok platform', () => {
    it('should always return true regardless of instagramAutoExtract', () => {
      expect(supportsAutoExtraction('tiktok', false)).toBe(true);
      expect(supportsAutoExtraction('tiktok', true)).toBe(true);
    });
  });

  describe('pinterest platform', () => {
    it('should always return true regardless of instagramAutoExtract', () => {
      expect(supportsAutoExtraction('pinterest', false)).toBe(true);
      expect(supportsAutoExtraction('pinterest', true)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Unknown platform
  // ---------------------------------------------------------------------------

  describe('unknown platform', () => {
    it('should return false for unknown platforms', () => {
      expect(supportsAutoExtraction('unknown')).toBe(false);
      expect(supportsAutoExtraction('unknown', true)).toBe(false);
    });
  });
});
