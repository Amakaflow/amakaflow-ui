import { useAuth } from '@clerk/clerk-react';
import { useMemo } from 'react';
import { getTierLimits, type Tier, type TierLimits } from '../lib/subscription';

/**
 * useSubscription — canonical tier + feature check for the web app.
 *
 * Reads the Clerk JWT via `has({ plan: 'pro' })` as the single source of
 * truth for plan membership. Returns a static TIER_LIMITS lookup for
 * display purposes.
 *
 * AMA-1453: localStorage-based usage counters (`importsRemaining`,
 * `canImport`) were removed — they were client-side only, unenforced, and
 * had zero production consumers. Real usage tracking will return under
 * AMA-1449 sub-project 1c (daily counter system), once AMA-1452 pricing
 * research is complete.
 */
export function useSubscription() {
  const { has, isLoaded } = useAuth();

  const tier: Tier = useMemo(() => {
    if (!isLoaded || !has) return 'free';
    try {
      // Check if user has the 'pro' plan via Clerk Billing
      if (has({ plan: 'pro' })) return 'pro';
    } catch {
      // Clerk may not have billing enabled — default to free
    }
    return 'free';
  }, [isLoaded, has]);

  const limits: TierLimits = useMemo(() => getTierLimits(tier), [tier]);
  const isPro = tier === 'pro';

  return {
    tier,
    isPro,
    isLoaded,
    limits,
    // Feature checks using Clerk's has() directly
    hasFeature: (feature: string): boolean => {
      if (!isLoaded || !has) return false;
      try {
        return has({ feature });
      } catch {
        return isPro; // Fallback to tier-based check
      }
    },
  };
}
