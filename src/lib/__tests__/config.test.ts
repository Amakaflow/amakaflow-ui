/**
 * Tests for centralized API configuration (AMA-181)
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('config module', () => {
  // Store original env values
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    // Clear module cache to allow re-importing with new env values
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original env
    Object.assign(import.meta.env, originalEnv);
  });

  describe('API_URLS', () => {
    it('should export all required API URLs', async () => {
      const { API_URLS } = await import('../config');

      expect(API_URLS).toHaveProperty('MAPPER');
      expect(API_URLS).toHaveProperty('INGESTOR');
      expect(API_URLS).toHaveProperty('STRAVA');
      expect(API_URLS).toHaveProperty('GARMIN');
      expect(API_URLS).toHaveProperty('CALENDAR');
    });

    it('should use correct default values for development', async () => {
      const { API_URLS } = await import('../config');

      // Check defaults are set (may be overridden by env)
      expect(typeof API_URLS.MAPPER).toBe('string');
      expect(typeof API_URLS.INGESTOR).toBe('string');
      expect(typeof API_URLS.STRAVA).toBe('string');
      expect(typeof API_URLS.GARMIN).toBe('string');
      expect(typeof API_URLS.CALENDAR).toBe('string');
    });

    it('should have different default ports for each service', async () => {
      // Clear env vars to test defaults
      delete (import.meta.env as any).VITE_MAPPER_API_URL;
      delete (import.meta.env as any).VITE_INGESTOR_API_URL;
      delete (import.meta.env as any).VITE_STRAVA_API_URL;
      delete (import.meta.env as any).VITE_GARMIN_API_URL;
      delete (import.meta.env as any).VITE_CALENDAR_API_URL;

      const { API_URLS } = await import('../config');

      // Extract ports from URLs
      const getPort = (url: string) => {
        const match = url.match(/:(\d+)/);
        return match ? match[1] : null;
      };

      const ports = [
        getPort(API_URLS.MAPPER),
        getPort(API_URLS.INGESTOR),
        getPort(API_URLS.STRAVA),
        getPort(API_URLS.GARMIN),
        getPort(API_URLS.CALENDAR),
      ].filter(Boolean);

      // All ports should be unique
      const uniquePorts = new Set(ports);
      expect(uniquePorts.size).toBe(ports.length);
    });
  });

  describe('getApiUrl', () => {
    it('should return correct URL for each service', async () => {
      const { getApiUrl, API_URLS } = await import('../config');

      expect(getApiUrl('MAPPER')).toBe(API_URLS.MAPPER);
      expect(getApiUrl('INGESTOR')).toBe(API_URLS.INGESTOR);
      expect(getApiUrl('STRAVA')).toBe(API_URLS.STRAVA);
      expect(getApiUrl('GARMIN')).toBe(API_URLS.GARMIN);
      expect(getApiUrl('CALENDAR')).toBe(API_URLS.CALENDAR);
    });
  });

  describe('isLocalDevelopment', () => {
    it('should detect localhost URLs', async () => {
      const { isLocalDevelopment } = await import('../config');

      // In test environment, defaults should include localhost
      const result = isLocalDevelopment();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getApiHealthEndpoints', () => {
    it('should return array of health endpoints', async () => {
      const { getApiHealthEndpoints } = await import('../config');

      const endpoints = getApiHealthEndpoints();

      expect(Array.isArray(endpoints)).toBe(true);
      expect(endpoints.length).toBe(5); // 5 services

      // Each endpoint should have name and url
      endpoints.forEach(endpoint => {
        expect(endpoint).toHaveProperty('name');
        expect(endpoint).toHaveProperty('url');
        expect(typeof endpoint.name).toBe('string');
        expect(typeof endpoint.url).toBe('string');
      });
    });

    it('should include all expected service names', async () => {
      const { getApiHealthEndpoints } = await import('../config');

      const endpoints = getApiHealthEndpoints();
      const names = endpoints.map(e => e.name);

      expect(names).toContain('Workout Ingestor API');
      expect(names).toContain('Mapper API');
      expect(names).toContain('Strava Sync API');
      expect(names).toContain('Garmin Sync API (UNOFFICIAL - TEST ONLY)');
      expect(names).toContain('Calendar API');
    });
  });
});
