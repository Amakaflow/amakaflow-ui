/**
 * Centralized API configuration for all backend services.
 *
 * This module provides a single source of truth for all API base URLs,
 * using environment variables with sensible defaults for local development.
 *
 * Environment variables:
 * - VITE_MAPPER_API_URL: Mapper API (exercise mapping, mobile pairing)
 * - VITE_INGESTOR_API_URL: Workout Ingestor API (video processing, workouts)
 * - VITE_STRAVA_API_URL: Strava Sync API (Strava integration)
 * - VITE_GARMIN_API_URL: Garmin Sync API (Garmin integration)
 * - VITE_CALENDAR_API_URL: Calendar API (calendar sync, smart planner)
 */

// API Base URLs with environment variable support
export const API_URLS = {
  /**
   * Mapper API - handles exercise mapping, mobile device pairing, follow-along workouts
   * Default: http://localhost:8001
   */
  MAPPER: import.meta.env.VITE_MAPPER_API_URL || 'http://localhost:8001',

  /**
   * Workout Ingestor API - handles video processing, workout ingestion, exports
   * Default: http://localhost:8004
   */
  INGESTOR: import.meta.env.VITE_INGESTOR_API_URL || 'http://localhost:8004',

  /**
   * Strava Sync API - handles Strava OAuth and activity sync
   * Default: http://localhost:8000
   */
  STRAVA: import.meta.env.VITE_STRAVA_API_URL || 'http://localhost:8000',

  /**
   * Garmin Sync API - handles Garmin integration (UNOFFICIAL - TEST ONLY)
   * Default: http://localhost:8002
   */
  GARMIN: import.meta.env.VITE_GARMIN_API_URL || 'http://localhost:8002',

  /**
   * Calendar API - handles calendar sync and smart planner features
   * Default: http://localhost:8003
   */
  CALENDAR: import.meta.env.VITE_CALENDAR_API_URL || 'http://localhost:8003',
} as const;

// Type for API URL keys
export type ApiServiceName = keyof typeof API_URLS;

/**
 * Get the base URL for a specific API service.
 * @param service - The API service name
 * @returns The base URL for the service
 */
export function getApiUrl(service: ApiServiceName): string {
  return API_URLS[service];
}

/**
 * Check if we're running in development mode (using localhost URLs).
 * Useful for enabling dev-only features like DevSystemStatus.
 */
export function isLocalDevelopment(): boolean {
  return Object.values(API_URLS).some(url =>
    url.includes('localhost') || url.includes('127.0.0.1')
  );
}

/**
 * Get all API service endpoints for health checking.
 * Used by DevSystemStatus component.
 */
export function getApiHealthEndpoints(): Array<{ name: string; url: string }> {
  return [
    { name: 'Workout Ingestor API', url: `${API_URLS.INGESTOR}/version` },
    { name: 'Mapper API', url: `${API_URLS.MAPPER}/mappings` },
    { name: 'Strava Sync API', url: `${API_URLS.STRAVA}/health` },
    { name: 'Garmin Sync API (UNOFFICIAL - TEST ONLY)', url: `${API_URLS.GARMIN}/health` },
    { name: 'Calendar API', url: `${API_URLS.CALENDAR}/health` },
  ];
}
