/**
 * Subscription and usage tracking for Free vs Pro tiers.
 * Uses Clerk Billing for tier detection and feature gating.
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

// These functions are called from React components that have access to useAuth()
// For non-hook contexts, use the hook-based versions below

export function getTierLimits(tier: Tier): TierLimits {
  return TIER_LIMITS[tier];
}

export function isFeatureAvailable(tier: Tier, feature: keyof TierLimits): boolean {
  const limits = TIER_LIMITS[tier];
  const value = limits[feature];
  return typeof value === 'boolean' ? value : true;
}

// Usage tracking (localStorage — complementary to Clerk's subscription status)
const USAGE_KEY = 'amakaflow_usage';

interface UsageData {
  importsThisMonth: number;
  monthKey: string;
  connectedDevices: string[];
}

function getCurrentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getUsage(): UsageData {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as UsageData;
      if (data.monthKey !== getCurrentMonthKey()) {
        return { importsThisMonth: 0, monthKey: getCurrentMonthKey(), connectedDevices: data.connectedDevices || [] };
      }
      return data;
    }
  } catch (e) {
    console.warn('Usage tracking unavailable:', e);
  }
  return { importsThisMonth: 0, monthKey: getCurrentMonthKey(), connectedDevices: [] };
}

function saveUsage(data: UsageData): void {
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
}

export function trackImport(): void {
  const usage = getUsage();
  usage.importsThisMonth++;
  saveUsage(usage);
}

export function getImportsUsed(): number {
  return getUsage().importsThisMonth;
}

export function getImportsRemaining(tier: Tier): number {
  const limits = getTierLimits(tier);
  if (limits.importsPerMonth === Infinity) return Infinity;
  return Math.max(0, limits.importsPerMonth - getUsage().importsThisMonth);
}

export function canImport(tier: Tier): boolean {
  return getImportsRemaining(tier) > 0;
}
