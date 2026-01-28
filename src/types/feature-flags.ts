/**
 * Feature flag types for chat feature rollout.
 * Part of AMA-437: Feature Flags & Beta Rollout Configuration
 */

/**
 * Rate limit tier determines the monthly message limit.
 */
export type RateLimitTier = 'free' | 'paid' | 'unlimited';

/**
 * Chat feature flags controlling the AI assistant capabilities.
 */
export interface ChatFeatureFlags {
  /** Master kill switch - if false, chat is completely disabled */
  chat_enabled: boolean;

  /** Beta period active - if true, only users with chat_beta_access can use chat */
  chat_beta_period: boolean;

  /** User has beta access - grants access during beta period */
  chat_beta_access: boolean;

  /** Voice input feature enabled */
  chat_voice_enabled: boolean;

  /** Rate limit tier for the user */
  chat_rate_limit_tier: RateLimitTier;

  /** List of enabled function/tool names for the user */
  chat_functions_enabled: string[];
}

/**
 * Default feature flag values used when no flags are configured.
 */
export const DEFAULT_CHAT_FLAGS: ChatFeatureFlags = {
  chat_enabled: true,
  chat_beta_period: true,
  chat_beta_access: false,
  chat_voice_enabled: true,
  chat_rate_limit_tier: 'free',
  chat_functions_enabled: ['get_user_profile', 'search_workouts', 'get_workout_history'],
};

/**
 * Result from the useChatFeatureFlags hook.
 */
export interface UseChatFeatureFlagsResult {
  /** Resolved feature flags */
  flags: ChatFeatureFlags;

  /** Loading state */
  isLoading: boolean;

  /** Error message if flag fetching failed */
  error: string | null;

  /** Manually refresh flags from the database */
  refresh: () => Promise<void>;
}

/**
 * Feedback sentiment for the beta feedback widget.
 */
export type FeedbackSentiment = 'positive' | 'negative' | 'neutral';

/**
 * Chat feedback submission payload.
 */
export interface ChatFeedback {
  sentiment: FeedbackSentiment;
  feedback_text?: string;
  feature?: string;
  session_id?: string;
  message_id?: string;
  metadata?: Record<string, unknown>;
}
