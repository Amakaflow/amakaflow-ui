/**
 * Subscription and usage tracking for Free vs Pro tiers.
 * During beta: everything unlocked. Post-beta: enforce limits.
 */

// Tier definitions matching landing page pricing
export type Tier = 'free' | 'pro';

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

// Beta override — everything unlocked during beta
const IS_BETA = true; // Flip to false when billing is live

export function getUserTier(): Tier {
  if (IS_BETA) return 'pro'; // Beta: everyone gets Pro
  // TODO: Read from user profile / Stripe subscription
  return 'free';
}

export function getTierLimits(): TierLimits {
  return TIER_LIMITS[getUserTier()];
}

export function isFeatureAvailable(feature: keyof TierLimits): boolean {
  const limits = getTierLimits();
  const value = limits[feature];
  return typeof value === 'boolean' ? value : true;
}

// Usage tracking (stored in localStorage during beta, Supabase post-beta)
const USAGE_KEY = 'amakaflow_usage';

interface UsageData {
  importsThisMonth: number;
  monthKey: string; // "2026-04"
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
      // Reset if month changed
      if (data.monthKey !== getCurrentMonthKey()) {
        return { importsThisMonth: 0, monthKey: getCurrentMonthKey(), connectedDevices: data.connectedDevices || [] };
      }
      return data;
    }
  } catch {
    // ignore parse errors
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

export function getImportsRemaining(): number {
  const limits = getTierLimits();
  if (limits.importsPerMonth === Infinity) return Infinity;
  const usage = getUsage();
  return Math.max(0, limits.importsPerMonth - usage.importsThisMonth);
}

export function canImport(): boolean {
  return getImportsRemaining() > 0;
}
