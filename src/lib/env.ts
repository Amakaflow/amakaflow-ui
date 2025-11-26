/**
 * Environment configuration and feature flags
 */

/**
 * Feature flag: Enable Garmin USB FIT Export functionality
 * 
 * Set VITE_ENABLE_GARMIN_USB_EXPORT=true in .env.local to enable.
 * Default: false (disabled)
 */
export const ENABLE_GARMIN_USB_EXPORT =
  import.meta.env.VITE_ENABLE_GARMIN_USB_EXPORT === 'true';
