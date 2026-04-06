import { useAuth } from '@clerk/clerk-react';
import { useMemo } from 'react';
import { getTierLimits, getImportsRemaining, canImport, type Tier, type TierLimits } from '../lib/subscription';

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
    importsRemaining: getImportsRemaining(tier),
    canImport: canImport(tier),
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
