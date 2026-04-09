/**
 * Subscription tier definitions and static limits for display.
 *
 * AMA-1453: The localStorage-based usage tracking (`trackImport`,
 * `getImportsRemaining`, `canImport`, etc) was removed — it was a client-
 * side counter with no backend enforcement and no production consumers.
 * Real usage-based limits will live in the new daily counter system built
 * under AMA-1449 sub-project 1c, once pricing research (AMA-1452) is done.
 *
 * This file now exposes only the static tier metadata that UI components
 * need for display purposes. Tier membership itself is checked via
 * `useSubscription()` (which wraps Clerk's `has({ plan: 'pro' })`).
 */

export type Tier = 'free' | 'pro';

export const PRO_PRICE_DISPLAY = '$9.99/mo';
export const PRO_ANNUAL_DISPLAY = '$75.00/yr';

export interface TierLimits {
  importsPerMonth: number;
  maxDevices: number;
  aiPlanning: boolean;
  autoRebalancing: boolean;
  coachChat: boolean;
  coachMemory: boolean;
  advancedAnalytics: boolean;
  connectedCalendars: boolean;
}

// AMA-1452 will replace these numbers with research-backed values. The
// current constants are display-only placeholders retained so dependent
// UI components continue to type-check until the new counter system
// (AMA-1449 sub-project 1c) replaces them entirely.
export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    importsPerMonth: 5,
    maxDevices: 1,
    aiPlanning: false,
    autoRebalancing: false,
    coachChat: false,
    coachMemory: false,
    advancedAnalytics: false,
    connectedCalendars: false,
  },
  pro: {
    importsPerMonth: Infinity,
    maxDevices: Infinity,
    aiPlanning: true,
    autoRebalancing: true,
    coachChat: true,
    coachMemory: true,
    advancedAnalytics: true,
    connectedCalendars: true,
  },
};

export function getTierLimits(tier: Tier): TierLimits {
  return TIER_LIMITS[tier];
}

export function isFeatureAvailable(tier: Tier, feature: keyof TierLimits): boolean {
  const limits = TIER_LIMITS[tier];
  const value = limits[feature];
  return typeof value === 'boolean' ? value : true;
}
