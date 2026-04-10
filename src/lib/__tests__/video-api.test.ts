import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../authenticated-fetch', () => ({ authenticatedFetch: vi.fn() }));

import { detectVideoUrl, fetchOEmbed, getPlatformDisplayName } from '../video-api';
import { authenticatedFetch } from '../authenticated-fetch';

const mockFetch = vi.mocked(authenticatedFetch);

describe('video-api', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('detectVideoUrl', () => {
    it('returns detection result', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ platform: 'youtube', video_id: 'abc123', normalized_url: 'https://youtube.com/watch?v=abc123', original_url: 'https://youtu.be/abc123', post_type: null }),
      } as any);
      const result = await detectVideoUrl('https://youtu.be/abc123');
      expect(result.platform).toBe('youtube');
      expect(result.video_id).toBe('abc123');
    });
  });

  describe('fetchOEmbed', () => {
    it('returns oembed data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, platform: 'youtube', title: 'Workout Video', author_name: 'Trainer' }),
      } as any);
      const result = await fetchOEmbed('https://youtube.com/watch?v=abc');
      expect(result.success).toBe(true);
      expect(result.title).toBe('Workout Video');
    });
  });

  describe('getPlatformDisplayName', () => {
    it('returns correct display names', () => {
      expect(getPlatformDisplayName('youtube')).toBe('YouTube');
      expect(getPlatformDisplayName('instagram')).toBe('Instagram');
      expect(getPlatformDisplayName('tiktok')).toBe('TikTok');
      expect(getPlatformDisplayName('pinterest')).toBe('Pinterest');
      expect(getPlatformDisplayName('unknown')).toBe('Unknown');
    });
  });
});
