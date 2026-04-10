import { describe, it, expect } from 'vitest';
import { isChatAccessible } from '../useChatFeatureFlags';
import type { ChatFeatureFlags } from '../../types/feature-flags';
import { DEFAULT_CHAT_FLAGS } from '../../types/feature-flags';

describe('isChatAccessible', () => {
  it('returns true when chat is enabled and not in beta', () => {
    const flags: ChatFeatureFlags = {
      ...DEFAULT_CHAT_FLAGS,
      chat_enabled: true,
      chat_beta_period: false,
    };
    expect(isChatAccessible(flags)).toBe(true);
  });

  it('returns false when chat is disabled', () => {
    const flags: ChatFeatureFlags = {
      ...DEFAULT_CHAT_FLAGS,
      chat_enabled: false,
    };
    expect(isChatAccessible(flags)).toBe(false);
  });

  it('returns false when in beta period without beta access', () => {
    const flags: ChatFeatureFlags = {
      ...DEFAULT_CHAT_FLAGS,
      chat_enabled: true,
      chat_beta_period: true,
      chat_beta_access: false,
    };
    expect(isChatAccessible(flags)).toBe(false);
  });

  it('returns true when in beta period with beta access', () => {
    const flags: ChatFeatureFlags = {
      ...DEFAULT_CHAT_FLAGS,
      chat_enabled: true,
      chat_beta_period: true,
      chat_beta_access: true,
    };
    expect(isChatAccessible(flags)).toBe(true);
  });
});
