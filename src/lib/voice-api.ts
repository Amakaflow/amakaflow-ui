/**
 * Voice transcription API functions (AMA-229)
 *
 * Communicates with workout-ingestor-api for:
 * - Voice settings (provider, accent, fallback)
 * - Personal dictionary (corrections)
 * - Fitness vocabulary
 */

import { authenticatedFetch } from './authenticated-fetch';

const INGESTOR_API_URL = import.meta.env.VITE_INGESTOR_API_URL || 'http://localhost:8000';

// Types
export type TranscriptionProvider = 'whisperkit' | 'deepgram' | 'assemblyai' | 'smart';

export interface VoiceSettings {
  provider: TranscriptionProvider;
  cloud_fallback_enabled: boolean;
  accent_region: string;
}

export interface DictionaryCorrection {
  misheard: string;
  corrected: string;
  frequency: number;
  created_at?: string;
  updated_at?: string;
}

export interface FitnessVocabulary {
  version: string;
  total_terms: number;
  categories: Record<string, string[]>;
  flat_list: string[];
}

// Voice Settings API

export async function getVoiceSettings(): Promise<VoiceSettings> {
  const response = await authenticatedFetch(`${INGESTOR_API_URL}/voice/settings`);

  if (!response.ok) {
    throw new Error(`Failed to fetch voice settings: ${response.statusText}`);
  }

  return response.json();
}

export async function updateVoiceSettings(settings: VoiceSettings): Promise<{ success: boolean; settings: VoiceSettings }> {
  const response = await authenticatedFetch(`${INGESTOR_API_URL}/voice/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to update voice settings: ${response.statusText}`);
  }

  return response.json();
}

// Personal Dictionary API

export async function getPersonalDictionary(): Promise<{ corrections: DictionaryCorrection[]; count: number }> {
  const response = await authenticatedFetch(`${INGESTOR_API_URL}/voice/dictionary`);

  if (!response.ok) {
    throw new Error(`Failed to fetch dictionary: ${response.statusText}`);
  }

  return response.json();
}

export async function syncDictionary(corrections: DictionaryCorrection[]): Promise<{ success: boolean; synced: number }> {
  const response = await authenticatedFetch(`${INGESTOR_API_URL}/voice/dictionary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ corrections }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to sync dictionary: ${response.statusText}`);
  }

  return response.json();
}

export async function deleteCorrection(misheard: string): Promise<{ success: boolean; deleted: number }> {
  const response = await authenticatedFetch(`${INGESTOR_API_URL}/voice/dictionary`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ misheard }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to delete correction: ${response.statusText}`);
  }

  return response.json();
}

// Fitness Vocabulary API

export async function getFitnessVocabulary(): Promise<FitnessVocabulary> {
  // This endpoint doesn't require auth
  const response = await fetch(`${INGESTOR_API_URL}/voice/fitness-vocab`);

  if (!response.ok) {
    throw new Error(`Failed to fetch fitness vocabulary: ${response.statusText}`);
  }

  return response.json();
}

// Provider info for UI
export const PROVIDER_INFO: Record<TranscriptionProvider, { name: string; description: string; cost: string; badge?: string }> = {
  whisperkit: {
    name: 'On-Device (WhisperKit)',
    description: 'Privacy-first. Audio never leaves your device. Best for clear speech and US English.',
    cost: 'Free',
    badge: 'Free',
  },
  deepgram: {
    name: 'Cloud - Deepgram',
    description: 'Best accuracy & accent handling. Recommended for non-US accents and noisy environments.',
    cost: '~$0.01/min',
    badge: 'Premium',
  },
  assemblyai: {
    name: 'Cloud - AssemblyAI',
    description: 'Good accuracy, lowest cost. Best for budget-conscious users.',
    cost: '~$0.005/min',
    badge: 'Budget',
  },
  smart: {
    name: 'Smart (Recommended)',
    description: 'On-device first, automatic cloud fallback when confidence is low.',
    cost: 'Auto',
    badge: 'Recommended',
  },
};

export const ACCENT_OPTIONS = [
  { value: 'en-US', label: 'US English (Default)' },
  { value: 'en-GB', label: 'UK English' },
  { value: 'en-AU', label: 'Australian English' },
  { value: 'en-IN', label: 'Indian English' },
  { value: 'en-ZA', label: 'South African English' },
  { value: 'en-NG', label: 'Nigerian English' },
  { value: 'en', label: 'Other accented English' },
];
