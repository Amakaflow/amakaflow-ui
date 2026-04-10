import { describe, it, expect } from 'vitest';
import { getTierLimits, TIER_LIMITS, PRO_PRICE_DISPLAY, PRO_ANNUAL_DISPLAY } from '../subscription';
import type { Tier } from '../subscription';

describe('TIER_LIMITS', () => {
  it('has free and pro tiers', () => {
    expect(TIER_LIMITS).toHaveProperty('free');
    expect(TIER_LIMITS).toHaveProperty('pro');
  });

  it('free tier has restricted limits', () => {
    expect(TIER_LIMITS.free.importsPerMonth).toBeLessThan(TIER_LIMITS.pro.importsPerMonth);
    expect(TIER_LIMITS.free.aiPlanning).toBe(false);
    expect(TIER_LIMITS.free.coachChat).toBe(false);
  });

  it('pro tier has expanded limits', () => {
    expect(TIER_LIMITS.pro.aiPlanning).toBe(true);
    expect(TIER_LIMITS.pro.coachChat).toBe(true);
    expect(TIER_LIMITS.pro.maxDevices).toBeGreaterThan(TIER_LIMITS.free.maxDevices);
  });
});

describe('getTierLimits', () => {
  it('returns free limits for free tier', () => {
    expect(getTierLimits('free')).toEqual(TIER_LIMITS.free);
  });

  it('returns pro limits for pro tier', () => {
    expect(getTierLimits('pro')).toEqual(TIER_LIMITS.pro);
  });
});

describe('price constants', () => {
  it('has display prices', () => {
    expect(PRO_PRICE_DISPLAY).toContain('$');
    expect(PRO_ANNUAL_DISPLAY).toContain('$');
  });
});
