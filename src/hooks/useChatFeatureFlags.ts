/**
 * useChatFeatureFlags - React hook for chat feature flag resolution.
 *
 * Cascade resolution order (highest priority first):
 * 1. Environment variables (VITE_CHAT_* - global kill switches)
 * 2. Database user-specific flags
 * 3. Database global flags
 * 4. Clerk user metadata (for beta access)
 * 5. Default values
 *
 * Part of AMA-437: Feature Flags & Beta Rollout Configuration
 */

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase';
import { CHAT_ENABLED, CHAT_BETA_PERIOD, CHAT_VOICE_ENABLED } from '../lib/env';
import type {
  ChatFeatureFlags,
  UseChatFeatureFlagsResult,
  RateLimitTier,
} from '../types/feature-flags';
import { DEFAULT_CHAT_FLAGS } from '../types/feature-flags';

/**
 * Parse a JSONB value from the database into the expected type.
 */
function parseJsonbValue<T>(value: unknown, defaultValue: T): T {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'boolean' || typeof value === 'string' || typeof value === 'number') {
    return value as T;
  }
  if (Array.isArray(value)) return value as T;
  return defaultValue;
}

/**
 * Hook to get resolved chat feature flags for the current user.
 */
export function useChatFeatureFlags(): UseChatFeatureFlagsResult {
  const { user, isLoaded: isUserLoaded } = useUser();
  const [flags, setFlags] = useState<ChatFeatureFlags>(DEFAULT_CHAT_FLAGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFlags = useCallback(async () => {
    // Wait for user to be loaded
    if (!isUserLoaded) return;

    setIsLoading(true);
    setError(null);

    try {
      let dbFlags: Record<string, unknown> = {};

      // Fetch flags from database if user is authenticated
      if (user?.id) {
        const { data, error: rpcError } = await supabase.rpc('get_user_feature_flags', {
          p_user_id: user.id,
        });

        if (rpcError) {
          console.warn('Failed to fetch feature flags from database:', rpcError);
          // Continue with defaults, don't fail completely
        } else if (data) {
          dbFlags = data as Record<string, unknown>;
        }
      }

      // Check Clerk metadata for beta access
      const clerkBetaAccess = user?.publicMetadata?.chat_beta_access === true;

      // Resolve flags with cascade priority
      const resolvedFlags: ChatFeatureFlags = {
        // chat_enabled: env var kills it, otherwise check DB
        chat_enabled: CHAT_ENABLED && parseJsonbValue(dbFlags.chat_enabled, DEFAULT_CHAT_FLAGS.chat_enabled),

        // chat_beta_period: env var or DB
        chat_beta_period: CHAT_BETA_PERIOD || parseJsonbValue(dbFlags.chat_beta_period, DEFAULT_CHAT_FLAGS.chat_beta_period),

        // chat_beta_access: DB user flag > Clerk metadata > default
        chat_beta_access:
          parseJsonbValue(dbFlags.chat_beta_access, null as boolean | null) ??
          clerkBetaAccess ??
          DEFAULT_CHAT_FLAGS.chat_beta_access,

        // chat_voice_enabled: env var kills it, otherwise check DB
        chat_voice_enabled: CHAT_VOICE_ENABLED && parseJsonbValue(dbFlags.chat_voice_enabled, DEFAULT_CHAT_FLAGS.chat_voice_enabled),

        // chat_rate_limit_tier: DB flag > default
        chat_rate_limit_tier: parseJsonbValue(dbFlags.chat_rate_limit_tier, DEFAULT_CHAT_FLAGS.chat_rate_limit_tier) as RateLimitTier,

        // chat_functions_enabled: DB flag > default
        chat_functions_enabled: parseJsonbValue(dbFlags.chat_functions_enabled, DEFAULT_CHAT_FLAGS.chat_functions_enabled) as string[],
      };

      setFlags(resolvedFlags);
    } catch (err) {
      console.error('Error fetching feature flags:', err);
      setError(err instanceof Error ? err.message : 'Failed to load feature flags');
      // Keep current flags on error
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, user?.publicMetadata, isUserLoaded]);

  // Fetch flags on mount and when user changes
  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  return {
    flags,
    isLoading,
    error,
    refresh: fetchFlags,
  };
}

/**
 * Helper to check if chat should be accessible based on flags.
 * Returns true if chat is enabled AND (not in beta period OR user has beta access).
 */
export function isChatAccessible(flags: ChatFeatureFlags): boolean {
  if (!flags.chat_enabled) return false;
  if (flags.chat_beta_period && !flags.chat_beta_access) return false;
  return true;
}
