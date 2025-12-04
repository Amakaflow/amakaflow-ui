/**
 * Environment configuration with sensible defaults
 * 
 * For local development, create a .env.local file with your overrides.
 */

// Garmin USB Export - enabled by default
export const ENABLE_GARMIN_USB_EXPORT = 
  import.meta.env.VITE_ENABLE_GARMIN_USB_EXPORT !== 'false';  // Default to true unless explicitly disabled
