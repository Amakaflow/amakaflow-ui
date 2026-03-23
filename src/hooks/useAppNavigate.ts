import { useNavigate, useLocation } from 'react-router-dom';
import { useCallback } from 'react';
import type { View } from '../app/router';
import { VIEW_TO_PATH, pathToView } from './useUrlSync';

/**
 * App-level navigation hook.
 *
 * Wraps react-router's useNavigate so callers can still pass a View string
 * (e.g. 'workouts') and get routed to the correct path ('/workouts').
 *
 * Also exposes `currentView` derived from the current location so components
 * can highlight active tabs without prop-drilling.
 */
export function useAppNavigate() {
  const nav = useNavigate();
  const location = useLocation();

  const currentView: View = pathToView(location.pathname);

  const navigateTo = useCallback(
    (view: View) => {
      const path = VIEW_TO_PATH[view] || '/';
      nav(path);
    },
    [nav],
  );

  /** For use as a drop-in replacement for setCurrentView callbacks in hooks */
  const setCurrentView = navigateTo;

  return { navigateTo, setCurrentView, currentView, location };
}
