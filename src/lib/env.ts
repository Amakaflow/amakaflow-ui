/**
 * Environment configuration and feature flags
 */

export const ENABLE_GARMIN_USB_EXPORT =
  import.meta.env.VITE_ENABLE_GARMIN_USB_EXPORT !== 'false';

export const ENABLE_GARMIN_DEBUG =
  import.meta.env.VITE_ENABLE_GARMIN_DEBUG === 'true';

/**
 * Chat feature environment flags (AMA-437)
 * These serve as global kill switches that override database flags
 */

/** Master kill switch - set to 'false' to disable chat globally */
export const CHAT_ENABLED = import.meta.env.VITE_CHAT_ENABLED !== 'false';

/** Beta period active - when 'true', only users with beta access can use chat */
export const CHAT_BETA_PERIOD = import.meta.env.VITE_CHAT_BETA_PERIOD === 'true';

/** Voice input feature - set to 'false' to disable voice input globally */
export const CHAT_VOICE_ENABLED = import.meta.env.VITE_CHAT_VOICE_ENABLED !== 'false';
