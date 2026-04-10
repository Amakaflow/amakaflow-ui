import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../authenticated-fetch', () => ({
  authenticatedFetch: vi.fn(),
}));

import { getChatSettings, updateChatSettings, DEFAULT_CHAT_PREFERENCES } from '../chat-settings-api';
import { authenticatedFetch } from '../authenticated-fetch';

const mockFetch = vi.mocked(authenticatedFetch);

describe('chat-settings-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getChatSettings', () => {
    it('returns preferences on success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(DEFAULT_CHAT_PREFERENCES),
      } as any);

      const result = await getChatSettings();
      expect(result.tone).toBe('coach');
      expect(result.focus_areas).toContain('general');
    });

    it('throws on failure', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401 } as any);
      await expect(getChatSettings()).rejects.toThrow('Failed to load chat settings');
    });
  });

  describe('updateChatSettings', () => {
    it('sends PUT with preferences', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ...DEFAULT_CHAT_PREFERENCES, tone: 'casual' }),
      } as any);

      const result = await updateChatSettings({ tone: 'casual' });
      expect(result.tone).toBe('casual');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/chat/settings'),
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    it('throws with detail on failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false, status: 500,
        text: () => Promise.resolve('Internal error'),
      } as any);
      await expect(updateChatSettings({ tone: 'casual' })).rejects.toThrow('Failed to save chat settings');
    });
  });

  describe('DEFAULT_CHAT_PREFERENCES', () => {
    it('has valid defaults', () => {
      expect(DEFAULT_CHAT_PREFERENCES.tone).toBe('coach');
      expect(DEFAULT_CHAT_PREFERENCES.experience_level).toBe('intermediate');
      expect(DEFAULT_CHAT_PREFERENCES.preferred_style).toBe('conversational');
      expect(DEFAULT_CHAT_PREFERENCES.focus_areas).toEqual(['general']);
    });
  });
});
