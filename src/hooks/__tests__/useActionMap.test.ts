/**
 * Tests for useActionMap hook.
 * Verifies tool→visualization mapping with placeholder interpolation.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActionMap, getActionConfig } from '../useActionMap';

describe('useActionMap', () => {
  describe('getActionConfig', () => {
    it('returns label + ghost-preview type for generate_workout', () => {
      const { result } = renderHook(() => useActionMap());
      const config = result.current.getActionConfig('generate_workout', {});

      expect(config.label).toBe('Generating your workout');
      expect(config.type).toBe('ghost-preview');
      expect(config.target).toBe('[data-assistant-target="workout-preview"]');
    });

    it('interpolates label + target for navigate_to_page with page arg', () => {
      const { result } = renderHook(() => useActionMap());
      const config = result.current.getActionConfig('navigate_to_page', { page: 'library' });

      expect(config.label).toBe('Navigating to library');
      expect(config.target).toBe('[data-assistant-target="main-content"]');
      expect(config.type).toBe('none');
    });

    it('returns fallback config for unknown tools', () => {
      const { result } = renderHook(() => useActionMap());
      const config = result.current.getActionConfig('unknown_tool_xyz', { foo: 'bar' });

      expect(config.label).toBe('Processing...');
      expect(config.type).toBe('inline');
      expect(config.target).toBeUndefined();
    });
  });
});

describe('getActionConfig (standalone)', () => {
  it('returns label + ghost-preview type for generate_workout', () => {
    const config = getActionConfig('generate_workout', {});

    expect(config.label).toBe('Generating your workout');
    expect(config.type).toBe('ghost-preview');
    expect(config.target).toBe('[data-assistant-target="workout-preview"]');
  });

  it('interpolates label + target for navigate_to_page with page arg', () => {
    const config = getActionConfig('navigate_to_page', { page: 'library' });

    expect(config.label).toBe('Navigating to library');
    expect(config.target).toBe('[data-assistant-target="main-content"]');
    expect(config.type).toBe('none');
  });

  it('returns fallback config for unknown tools', () => {
    const config = getActionConfig('unknown_tool_xyz', { foo: 'bar' });

    expect(config.label).toBe('Processing...');
    expect(config.type).toBe('inline');
    expect(config.target).toBeUndefined();
  });

  it('leaves unresolved placeholders when arg is missing', () => {
    const config = getActionConfig('navigate_to_page', {});

    expect(config.label).toBe('Navigating to {page}');
  });

  it('returns correct config for save_and_push_workout', () => {
    const config = getActionConfig('save_and_push_workout', {});

    expect(config.label).toBe('Saving workout');
    expect(config.type).toBe('inline');
    expect(config.target).toBe('[data-assistant-target="workout-list"]');
  });

  it('returns correct config for search_workout_library', () => {
    const config = getActionConfig('search_workout_library', {});

    expect(config.label).toBe('Searching workout library');
    expect(config.type).toBe('ghost-preview');
    expect(config.target).toBe('[data-assistant-target="library-results"]');
  });
});
