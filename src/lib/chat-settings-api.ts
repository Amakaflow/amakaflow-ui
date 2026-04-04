/**
 * Chat settings API client — AMA-1422.
 *
 * GET  /chat/settings — fetch user's AI coach preferences
 * PUT  /chat/settings — save updated preferences
 */

import { API_URLS } from './config';
import { authenticatedFetch } from './authenticated-fetch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatTone = 'casual' | 'professional' | 'coach';
export type ChatFocusArea = 'strength' | 'running' | 'hyrox' | 'general' | 'cycling' | 'swimming';
export type ChatExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type ChatPreferredStyle = 'brief' | 'detailed' | 'conversational';

export interface ChatPreferences {
  tone: ChatTone;
  focus_areas: ChatFocusArea[];
  experience_level: ChatExperienceLevel;
  preferred_style: ChatPreferredStyle;
}

export const DEFAULT_CHAT_PREFERENCES: ChatPreferences = {
  tone: 'coach',
  focus_areas: ['general'],
  experience_level: 'intermediate',
  preferred_style: 'conversational',
};

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Fetch the current user's AI coach preferences.
 * Returns defaults on error so the UI always has something to render.
 */
export async function getChatSettings(): Promise<ChatPreferences> {
  const url = `${API_URLS.CHAT}/chat/settings`;
  const response = await authenticatedFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(`Failed to load chat settings: ${response.status}`);
  }

  return response.json() as Promise<ChatPreferences>;
}

/**
 * Persist the current user's AI coach preferences.
 * Sends a full preferences object; backend handles partial upsert.
 */
export async function updateChatSettings(prefs: Partial<ChatPreferences>): Promise<ChatPreferences> {
  const url = `${API_URLS.CHAT}/chat/settings`;
  const response = await authenticatedFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Failed to save chat settings: ${response.status} ${detail}`);
  }

  return response.json() as Promise<ChatPreferences>;
}
