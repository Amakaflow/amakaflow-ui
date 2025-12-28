/**
 * Video API client for workout-ingestor-api
 *
 * Handles video URL detection, oEmbed fetching, and caching
 * for multi-platform video workouts (YouTube, Instagram, TikTok, Pinterest)
 */

import { authenticatedFetch } from './authenticated-fetch';
import { API_URLS } from './config';

export type VideoPlatform = 'youtube' | 'instagram' | 'tiktok' | 'pinterest' | 'unknown';

export interface VideoDetectResponse {
  platform: VideoPlatform;
  video_id: string | null;
  normalized_url: string | null;
  original_url: string;
  post_type: string | null;
}

export interface OEmbedData {
  success: boolean;
  platform: VideoPlatform;
  video_id: string | null;
  title: string | null;
  author_name: string | null;
  author_url: string | null;
  thumbnail_url: string | null;
  thumbnail_width: number | null;
  thumbnail_height: number | null;
  html: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  post_type: string | null;
  error: string | null;
}

export interface CachedVideo {
  id: string;
  video_id: string;
  platform: VideoPlatform;
  source_url: string;
  normalized_url: string;
  oembed_data: Record<string, any>;
  video_metadata: Record<string, any>;
  workout_data: Record<string, any>;
  processing_method: string | null;
  ingested_by: string | null;
  cache_hits: number;
  created_at: string;
  updated_at: string;
}

export interface CacheCheckResponse {
  cached: boolean;
  cache_entry: CachedVideo | null;
}

export interface CacheStatsResponse {
  total_cached: number;
  total_cache_hits: number;
  by_platform: Record<string, { count: number; hits: number }>;
}

export interface WorkoutStep {
  label: string;
  duration_sec?: number;
  target_reps?: number;
  notes?: string;
}

export interface WorkoutData {
  title: string;
  description?: string;
  exercises: WorkoutStep[];
  source_link?: string;
}

// Use centralized API config
const WORKOUT_INGESTOR_API_URL = API_URLS.INGESTOR;

/**
 * Detect video platform and extract video ID from URL
 */
export async function detectVideoUrl(url: string): Promise<VideoDetectResponse> {
  const response = await authenticatedFetch(`${WORKOUT_INGESTOR_API_URL}/video/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Failed to detect video URL: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch oEmbed metadata for a video URL
 */
export async function fetchOEmbed(url: string, platform?: VideoPlatform): Promise<OEmbedData> {
  const response = await authenticatedFetch(`${WORKOUT_INGESTOR_API_URL}/video/oembed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, platform }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Failed to fetch oEmbed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Check if a video URL is already cached
 */
export async function checkVideoCache(url: string): Promise<CacheCheckResponse> {
  const response = await authenticatedFetch(`${WORKOUT_INGESTOR_API_URL}/video/cache/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Failed to check video cache: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Save a video workout to the cache
 */
export async function saveVideoToCache(params: {
  url: string;
  workout_data?: WorkoutData;
  oembed_data?: Record<string, any>;
  video_metadata?: Record<string, any>;
  processing_method?: string;
  ingested_by?: string;
}): Promise<{ cached: boolean; cache_entry: CachedVideo | null }> {
  const response = await authenticatedFetch(`${WORKOUT_INGESTOR_API_URL}/video/cache/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Failed to save to video cache: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get cached video by platform and video ID
 */
export async function getCachedVideo(platform: VideoPlatform, videoId: string): Promise<CachedVideo | null> {
  const response = await authenticatedFetch(`${WORKOUT_INGESTOR_API_URL}/video/cache/${platform}/${videoId}`);

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Failed to get cached video: ${response.statusText}`);
  }

  const data = await response.json();
  return data.cache_entry;
}

/**
 * Get video cache statistics
 */
export async function getVideoCacheStats(): Promise<CacheStatsResponse> {
  const response = await authenticatedFetch(`${WORKOUT_INGESTOR_API_URL}/video/cache/stats`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Failed to get cache stats: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Helper to determine if a platform supports auto-extraction
 * YouTube, TikTok, and Pinterest use AI/vision extraction
 * Instagram uses manual entry with oEmbed preview
 */
export function supportsAutoExtraction(platform: VideoPlatform): boolean {
  return platform === 'youtube' || platform === 'tiktok' || platform === 'pinterest';
}

/**
 * Helper to get platform display name
 */
export function getPlatformDisplayName(platform: VideoPlatform): string {
  switch (platform) {
    case 'youtube':
      return 'YouTube';
    case 'instagram':
      return 'Instagram';
    case 'tiktok':
      return 'TikTok';
    case 'pinterest':
      return 'Pinterest';
    default:
      return 'Unknown';
  }
}
