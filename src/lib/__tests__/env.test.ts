import { describe, it, expect } from 'vitest';
import { CHAT_ENABLED, CHAT_BETA_PERIOD, CHAT_VOICE_ENABLED, ENABLE_GARMIN_USB_EXPORT, ENABLE_GARMIN_DEBUG } from '../env';

describe('env flags', () => {
  it('CHAT_ENABLED defaults to true', () => {
    expect(CHAT_ENABLED).toBe(true);
  });

  it('CHAT_BETA_PERIOD defaults to false', () => {
    expect(CHAT_BETA_PERIOD).toBe(false);
  });

  it('CHAT_VOICE_ENABLED defaults to true', () => {
    expect(CHAT_VOICE_ENABLED).toBe(true);
  });

  it('ENABLE_GARMIN_USB_EXPORT defaults to true', () => {
    expect(ENABLE_GARMIN_USB_EXPORT).toBe(true);
  });

  it('ENABLE_GARMIN_DEBUG defaults to false', () => {
    expect(ENABLE_GARMIN_DEBUG).toBe(false);
  });

  it('all flags are booleans', () => {
    expect(typeof CHAT_ENABLED).toBe('boolean');
    expect(typeof CHAT_BETA_PERIOD).toBe('boolean');
    expect(typeof CHAT_VOICE_ENABLED).toBe('boolean');
    expect(typeof ENABLE_GARMIN_USB_EXPORT).toBe('boolean');
    expect(typeof ENABLE_GARMIN_DEBUG).toBe('boolean');
  });
});
