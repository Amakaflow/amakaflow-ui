/**
 * Tests for preferences.ts
 *
 * Covers:
 * - getInstagramAutoExtract defaults to false
 * - setInstagramAutoExtract persists to localStorage
 * - Corrupted localStorage falls back to defaults
 * - Partial preferences (missing instagramAutoExtract) defaults correctly
 * - Independence from imageProcessingMethod
 *
 * AMA-564: Instagram auto-extract preference storage.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPreferences,
  savePreferences,
  getInstagramAutoExtract,
  setInstagramAutoExtract,
  getImageProcessingMethod,
  setImageProcessingMethod,
} from '../preferences';

const PREFERENCES_KEY = 'amakaflow_preferences';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// getInstagramAutoExtract
// ---------------------------------------------------------------------------

describe('getInstagramAutoExtract', () => {
  it('should default to false when no preferences exist', () => {
    expect(getInstagramAutoExtract()).toBe(false);
  });

  it('should return false when preferences exist but key is missing', () => {
    localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ imageProcessingMethod: 'vision' }),
    );
    expect(getInstagramAutoExtract()).toBe(false);
  });

  it('should return true when set to true', () => {
    localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ instagramAutoExtract: true }),
    );
    expect(getInstagramAutoExtract()).toBe(true);
  });

  it('should return false when set to false', () => {
    localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ instagramAutoExtract: false }),
    );
    expect(getInstagramAutoExtract()).toBe(false);
  });

  it('should default to false when localStorage has corrupted JSON', () => {
    localStorage.setItem(PREFERENCES_KEY, '{not valid json!!!');
    expect(getInstagramAutoExtract()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// setInstagramAutoExtract
// ---------------------------------------------------------------------------

describe('setInstagramAutoExtract', () => {
  it('should persist true to localStorage', () => {
    setInstagramAutoExtract(true);

    const stored = JSON.parse(localStorage.getItem(PREFERENCES_KEY)!);
    expect(stored.instagramAutoExtract).toBe(true);
  });

  it('should persist false to localStorage', () => {
    setInstagramAutoExtract(true);
    setInstagramAutoExtract(false);

    const stored = JSON.parse(localStorage.getItem(PREFERENCES_KEY)!);
    expect(stored.instagramAutoExtract).toBe(false);
  });

  it('should be readable after set', () => {
    setInstagramAutoExtract(true);
    expect(getInstagramAutoExtract()).toBe(true);

    setInstagramAutoExtract(false);
    expect(getInstagramAutoExtract()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Independence from imageProcessingMethod
// ---------------------------------------------------------------------------

describe('preference independence', () => {
  it('should not affect imageProcessingMethod when setting instagramAutoExtract', () => {
    setImageProcessingMethod('vision');
    setInstagramAutoExtract(true);

    expect(getImageProcessingMethod()).toBe('vision');
    expect(getInstagramAutoExtract()).toBe(true);
  });

  it('should not affect instagramAutoExtract when setting imageProcessingMethod', () => {
    setInstagramAutoExtract(true);
    setImageProcessingMethod('ocr');

    expect(getInstagramAutoExtract()).toBe(true);
    expect(getImageProcessingMethod()).toBe('ocr');
  });
});

// ---------------------------------------------------------------------------
// getPreferences / savePreferences
// ---------------------------------------------------------------------------

describe('getPreferences', () => {
  it('should return defaults when localStorage is empty', () => {
    const prefs = getPreferences();
    expect(prefs.imageProcessingMethod).toBe('ocr');
    expect(prefs.instagramAutoExtract).toBe(false);
  });

  it('should merge stored preferences with defaults', () => {
    localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ instagramAutoExtract: true }),
    );

    const prefs = getPreferences();
    expect(prefs.instagramAutoExtract).toBe(true);
    expect(prefs.imageProcessingMethod).toBe('ocr'); // default
  });
});

describe('savePreferences', () => {
  it('should merge partial preferences with existing', () => {
    savePreferences({ imageProcessingMethod: 'vision' });
    savePreferences({ instagramAutoExtract: true });

    const stored = JSON.parse(localStorage.getItem(PREFERENCES_KEY)!);
    expect(stored.imageProcessingMethod).toBe('vision');
    expect(stored.instagramAutoExtract).toBe(true);
  });
});
