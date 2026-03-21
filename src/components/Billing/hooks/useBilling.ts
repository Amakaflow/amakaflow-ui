/**
 * useBilling — subscription state management and feature checks.
 *
 * AMA-1134: Provides subscription data, feature gating, and upgrade actions.
 */

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Plan = 'free' | 'premium';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid';

export interface SubscriptionInfo {
  plan: Plan;
  status: SubscriptionStatus;
  isPremium: boolean;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  coachMessagesLimit: number;
  coachMessagesUsed: number;
  platformConnectionsLimit: number;
}

export interface FeatureGateResult {
  allowed: boolean;
  plan: Plan;
  feature: string;
  upgradeUrl: string | null;
}

export interface UseBillingReturn {
  subscription: SubscriptionInfo | null;
  loading: boolean;
  error: string | null;
  isPremium: boolean;
  checkFeature: (feature: string) => Promise<FeatureGateResult>;
  startCheckout: () => Promise<void>;
  openPortal: () => Promise<void>;
  refresh: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_CHAT_API_URL || 'http://localhost:8005';

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('auth_token') || '';
  const resp = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
      ...options?.headers,
    },
  });
  if (!resp.ok) {
    throw new Error(`Billing API error: ${resp.status}`);
  }
  return resp.json();
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBilling(): UseBillingReturn {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<{
        plan: Plan;
        status: SubscriptionStatus;
        is_premium: boolean;
        current_period_end: string | null;
        trial_end: string | null;
        coach_messages_limit: number;
        coach_messages_used: number;
        platform_connections_limit: number;
      }>('/billing/subscription');

      setSubscription({
        plan: data.plan,
        status: data.status,
        isPremium: data.is_premium,
        currentPeriodEnd: data.current_period_end,
        trialEnd: data.trial_end,
        coachMessagesLimit: data.coach_messages_limit,
        coachMessagesUsed: data.coach_messages_used,
        platformConnectionsLimit: data.platform_connections_limit,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription');
      // Default to free plan on error
      setSubscription({
        plan: 'free',
        status: 'active',
        isPremium: false,
        currentPeriodEnd: null,
        trialEnd: null,
        coachMessagesLimit: 5,
        coachMessagesUsed: 0,
        platformConnectionsLimit: 2,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const checkFeature = useCallback(async (feature: string): Promise<FeatureGateResult> => {
    try {
      const data = await fetchJson<{
        allowed: boolean;
        plan: Plan;
        feature: string;
        upgrade_url: string | null;
      }>(`/billing/feature-gate/${feature}`);
      return {
        allowed: data.allowed,
        plan: data.plan,
        feature: data.feature,
        upgradeUrl: data.upgrade_url,
      };
    } catch {
      // Fail open for non-premium features, closed for premium
      return { allowed: false, plan: 'free', feature, upgradeUrl: '/pricing' };
    }
  }, []);

  const startCheckout = useCallback(async () => {
    const data = await fetchJson<{ url: string }>('/billing/checkout', { method: 'POST' });
    window.location.href = data.url;
  }, []);

  const openPortal = useCallback(async () => {
    const data = await fetchJson<{ url: string }>('/billing/portal', { method: 'POST' });
    window.location.href = data.url;
  }, []);

  return {
    subscription,
    loading,
    error,
    isPremium: subscription?.isPremium ?? false,
    checkFeature,
    startCheckout,
    openPortal,
    refresh,
  };
}
