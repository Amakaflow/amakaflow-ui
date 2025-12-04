/**
 * Environment configuration and feature flags
 */

export const ENABLE_GARMIN_USB_EXPORT =
  import.meta.env.VITE_ENABLE_GARMIN_USB_EXPORT !== 'false';

export const ENABLE_GARMIN_DEBUG =
  import.meta.env.VITE_ENABLE_GARMIN_DEBUG === 'true';
