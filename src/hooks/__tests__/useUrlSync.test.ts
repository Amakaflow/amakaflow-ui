import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  VIEW_TO_PATH,
  pathToView,
  getInitialViewFromUrl,
  useUrlSync,
} from '../useUrlSync';
import type { View } from '../../app/router';

describe('VIEW_TO_PATH mapping', () => {
  it('maps every View value to a unique path', () => {
    const paths = Object.values(VIEW_TO_PATH);
    const unique = new Set(paths);
    expect(unique.size).toBe(paths.length);
  });

  it('maps home to /', () => {
    expect(VIEW_TO_PATH.home).toBe('/');
  });

  it('maps connections to /settings/connections', () => {
    expect(VIEW_TO_PATH.connections).toBe('/settings/connections');
  });

  it('maps training-preferences to /settings/preferences', () => {
    expect(VIEW_TO_PATH['training-preferences']).toBe('/settings/preferences');
  });
});

describe('pathToView', () => {
  it('returns the correct view for a known path', () => {
    expect(pathToView('/')).toBe('home');
    expect(pathToView('/calendar')).toBe('calendar');
    expect(pathToView('/settings/connections')).toBe('connections');
    expect(pathToView('/settings/preferences')).toBe('training-preferences');
    expect(pathToView('/coach')).toBe('coach');
    expect(pathToView('/analytics')).toBe('analytics');
    expect(pathToView('/workouts')).toBe('workouts');
    expect(pathToView('/dashboard')).toBe('dashboard');
  });

  it('returns home for an unknown path', () => {
    expect(pathToView('/nonexistent')).toBe('home');
    expect(pathToView('/foo/bar')).toBe('home');
  });

  it('is the inverse of VIEW_TO_PATH for every view', () => {
    for (const [view, path] of Object.entries(VIEW_TO_PATH)) {
      expect(pathToView(path)).toBe(view);
    }
  });
});

describe('getInitialViewFromUrl', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Use a writable location mock
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, pathname: '/' },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('returns home for /', () => {
    window.location.pathname = '/';
    expect(getInitialViewFromUrl()).toBe('home');
  });

  it('returns calendar for /calendar', () => {
    window.location.pathname = '/calendar';
    expect(getInitialViewFromUrl()).toBe('calendar');
  });

  it('returns home for unknown paths', () => {
    window.location.pathname = '/unknown';
    expect(getInitialViewFromUrl()).toBe('home');
  });
});

describe('useUrlSync', () => {
  let pushStateSpy: ReturnType<typeof vi.spyOn>;
  const originalLocation = window.location;

  beforeEach(() => {
    pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, pathname: '/' },
    });
  });

  afterEach(() => {
    pushStateSpy.mockRestore();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('pushes URL when currentView changes', () => {
    const setCurrentView = vi.fn();
    const { rerender } = renderHook(
      ({ view }: { view: View }) =>
        useUrlSync({ currentView: view, setCurrentView }),
      { initialProps: { view: 'home' as View } }
    );

    // home -> /, but location is already /, so no push
    expect(pushStateSpy).not.toHaveBeenCalled();

    // Navigate to calendar
    rerender({ view: 'calendar' as View });
    expect(pushStateSpy).toHaveBeenCalledWith({}, '', '/calendar');
  });

  it('does NOT push if URL already matches the view', () => {
    window.location.pathname = '/analytics';
    const setCurrentView = vi.fn();

    renderHook(() =>
      useUrlSync({ currentView: 'analytics', setCurrentView })
    );

    expect(pushStateSpy).not.toHaveBeenCalled();
  });

  it('responds to popstate events (browser back/forward)', () => {
    const setCurrentView = vi.fn();

    renderHook(() =>
      useUrlSync({ currentView: 'home', setCurrentView })
    );

    // Simulate browser back to /workouts
    window.location.pathname = '/workouts';
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(setCurrentView).toHaveBeenCalledWith('workouts');
  });

  it('does NOT call setCurrentView if popstate path matches current view', () => {
    window.location.pathname = '/calendar';
    const setCurrentView = vi.fn();

    renderHook(() =>
      useUrlSync({ currentView: 'calendar', setCurrentView })
    );

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(setCurrentView).not.toHaveBeenCalled();
  });
});
