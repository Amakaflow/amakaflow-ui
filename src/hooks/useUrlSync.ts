import { useEffect, useCallback } from 'react';
import type { View } from '../app/router';

/**
 * Bi-directional mapping between View state and URL pathnames.
 * Phase 1: URL reflects current view; browser back/forward works; bookmarks resolve.
 */
export const VIEW_TO_PATH: Record<View, string> = {
  home: '/',
  workflow: '/workflow',
  profile: '/profile',
  analytics: '/analytics',
  team: '/team',
  settings: '/settings',
  'strava-enhance': '/strava-enhance',
  calendar: '/calendar',
  workouts: '/workouts',
  'mobile-companion': '/mobile-companion',
  import: '/import',
  help: '/help',
  'program-detail': '/programs/detail',
  programs: '/programs',
  'create-ai': '/create-ai',
  'export-page': '/export',
  connections: '/settings/connections',
  coach: '/coach',
  'training-preferences': '/settings/preferences',
  dashboard: '/dashboard',
};

const PATH_TO_VIEW: Record<string, View> = Object.fromEntries(
  Object.entries(VIEW_TO_PATH).map(([view, path]) => [path, view as View])
) as Record<string, View>;

/**
 * Resolve a pathname to a View. Falls back to 'home' for unknown paths.
 */
export function pathToView(pathname: string): View {
  return PATH_TO_VIEW[pathname] ?? 'home';
}

/**
 * Read the initial view from the current URL on mount.
 */
export function getInitialViewFromUrl(): View {
  return pathToView(window.location.pathname);
}

interface UseUrlSyncOptions {
  currentView: View;
  setCurrentView: (view: View) => void;
}

/**
 * Hook that keeps the browser URL bar in sync with the app's currentView state.
 *
 * - pushState when currentView changes (so browser history accumulates)
 * - listens to popstate so back/forward buttons update the view
 */
export function useUrlSync({ currentView, setCurrentView }: UseUrlSyncOptions) {
  // Push URL when view changes
  useEffect(() => {
    const path = VIEW_TO_PATH[currentView] || '/';
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
  }, [currentView]);

  // Listen for browser back/forward
  const handlePopState = useCallback(() => {
    const view = pathToView(window.location.pathname);
    if (view !== currentView) {
      setCurrentView(view);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, setCurrentView]);

  useEffect(() => {
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [handlePopState]);
}
