/**
 * useActionMap - React hook for tool→visualization mapping.
 *
 * Maps tool names to visualization configurations including:
 * - label: Human-readable label for the UI
 * - target: CSS selector for the target element (for ghost-preview positioning)
 * - type: Visualization type (ghost-preview, inline, toast, etc.)
 *
 * Supports `{placeholder}` interpolation from tool input arguments.
 *
 * Part of AMA-630: Create useActionMap hook for tool→visualization mapping
 */

import { useCallback } from 'react';

/** Visualization types supported by the UI */
export type VisualizationType = 'ghost-preview' | 'inline' | 'toast' | 'none';

/** Configuration for tool action visualization */
export interface ActionConfig {
  /** Human-readable label (supports {placeholder} interpolation) */
  label: string;
  /** CSS selector for target element (supports {placeholder} interpolation) */
  target?: string;
  /** Visualization type */
  type: VisualizationType;
}

/** Input arguments passed to a tool (key-value pairs) */
export interface ToolInputArgs {
  [key: string]: unknown;
}

/** Default fallback configuration for unknown tools */
const DEFAULT_ACTION_CONFIG: ActionConfig = {
  label: 'Processing...',
  type: 'inline',
};

/**
 * Tool name to visualization config mapping.
 * Add new tools here as they're implemented.
 */
const ACTION_MAP: Record<string, Omit<ActionConfig, 'label'>> & { label: Record<string, string> } = {
  // Tool name : config (label is a template string)
  generate_workout: {
    label: 'Generating your workout',
    target: '#workout-preview',
    type: 'ghost-preview',
  },
  save_and_push_workout: {
    label: 'Saving workout',
    target: '#workout-list',
    type: 'inline',
  },
  search_workout_library: {
    label: 'Searching workout library',
    target: '#library-results',
    type: 'ghost-preview',
  },
  navigate_to_page: {
    label: 'Navigating to {page}',
    target: '#main-content',
    type: 'none',
  },
  lookup_user_profile: {
    label: 'Looking up your profile',
    target: '#user-profile',
    type: 'inline',
  },
  get_user_preferences: {
    label: 'Loading your preferences',
    target: '#preferences-panel',
    type: 'inline',
  },
  get_workout_history: {
    label: 'Fetching workout history',
    target: '#workout-history',
    type: 'ghost-preview',
  },
  create_workout_plan: {
    label: 'Creating workout plan',
    target: '#workout-plan',
    type: 'ghost-preview',
  },
  search_exercises: {
    label: 'Searching exercises',
    target: '#exercise-search-results',
    type: 'ghost-preview',
  },
  log_workout: {
    label: 'Logging workout',
    target: '#workout-log',
    type: 'inline',
  },
};

/**
 * Interpolate placeholders in a template string using input args.
 * Supports {key} syntax - replaces {key} with value from args.
 *
 * @param template - Template string with {placeholder} syntax
 * @param args - Input arguments to substitute
 * @returns Interpolated string
 */
function interpolate(template: string, args: ToolInputArgs): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = args[key];
    if (value === undefined || value === null) {
      return `{${key}}`; // Leave placeholder if not found
    }
    return String(value);
  });
}

/**
 * Hook to get action configuration for a given tool name.
 *
 * @returns Object containing getActionConfig function
 */
export function useActionMap() {
  const getActionConfig = useCallback((toolName: string, args: ToolInputArgs): ActionConfig => {
    const config = ACTION_MAP[toolName];

    if (!config) {
      return {
        ...DEFAULT_ACTION_CONFIG,
        label: interpolate(DEFAULT_ACTION_CONFIG.label, args),
      };
    }

    return {
      label: interpolate(config.label, args),
      target: config.target ? interpolate(config.target, args) : undefined,
      type: config.type,
    };
  }, []);

  return {
    getActionConfig,
  };
}

/**
 * Standalone function version of getActionConfig for non-hook contexts.
 * Useful for testing and non-React code.
 */
export function getActionConfig(toolName: string, args: ToolInputArgs): ActionConfig {
  const config = ACTION_MAP[toolName];

  if (!config) {
    return {
      ...DEFAULT_ACTION_CONFIG,
      label: interpolate(DEFAULT_ACTION_CONFIG.label, args),
    };
  }

  return {
    label: interpolate(config.label, args),
    target: config.target ? interpolate(config.target, args) : undefined,
    type: config.type,
  };
}
