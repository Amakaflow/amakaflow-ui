/**
 * Test fixtures for Instagram Apify auto-extraction E2E tests (AMA-565).
 *
 * Provides:
 * - localStorage preference payloads (manual vs auto mode)
 * - Mock API responses for video/detect, video/oembed, ingest/instagram_reel
 * - Mock Clerk user objects for free/pro/trainer tiers
 * - Apify failure responses for fallback testing
 */

// ---------------------------------------------------------------------------
// Instagram URL constants
// ---------------------------------------------------------------------------

export const INSTAGRAM_REEL_URL = 'https://www.instagram.com/reel/C1234567890/';
export const INSTAGRAM_REEL_URL_SHORT = 'https://instagr.am/reel/C1234567890/';
export const YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

// ---------------------------------------------------------------------------
// localStorage preference payloads
// ---------------------------------------------------------------------------

export const PREFERENCES_KEY = 'amakaflow_preferences';

export const PREFS_MANUAL_MODE = {
  imageProcessingMethod: 'ocr',
  instagramAutoExtract: false,
};

export const PREFS_AUTO_MODE = {
  imageProcessingMethod: 'ocr',
  instagramAutoExtract: true,
};

// ---------------------------------------------------------------------------
// Mock user objects (simulating Clerk user with subscription tier)
// ---------------------------------------------------------------------------

export const FREE_USER = {
  id: 'user_free_test',
  name: 'Free User',
  email: 'free@test.com',
  subscription: 'free',
  selectedDevices: ['garmin'],
  billingDate: undefined,
  address: '',
  city: '',
  state: '',
  zipCode: '',
};

export const PRO_USER = {
  id: 'user_pro_test',
  name: 'Pro User',
  email: 'pro@test.com',
  subscription: 'pro',
  selectedDevices: ['garmin', 'apple'],
  billingDate: new Date('2026-03-15'),
  address: '',
  city: '',
  state: '',
  zipCode: '',
};

export const TRAINER_USER = {
  id: 'user_trainer_test',
  name: 'Trainer User',
  email: 'trainer@test.com',
  subscription: 'trainer',
  selectedDevices: ['garmin', 'apple'],
  billingDate: new Date('2026-03-15'),
  address: '',
  city: '',
  state: '',
  zipCode: '',
};

// ---------------------------------------------------------------------------
// Video detect API responses
// ---------------------------------------------------------------------------

export const DETECT_INSTAGRAM_RESPONSE = {
  platform: 'instagram',
  video_id: 'C1234567890',
  normalized_url: INSTAGRAM_REEL_URL,
  original_url: INSTAGRAM_REEL_URL,
  post_type: 'reel',
};

// ---------------------------------------------------------------------------
// oEmbed API responses
// ---------------------------------------------------------------------------

export const OEMBED_INSTAGRAM_SUCCESS = {
  success: true,
  platform: 'instagram',
  video_id: 'C1234567890',
  title: null,
  author_name: 'fitnessguru',
  author_url: 'https://www.instagram.com/fitnessguru/',
  thumbnail_url: 'https://example.com/thumb.jpg',
  thumbnail_width: 640,
  thumbnail_height: 640,
  html: '<blockquote class="instagram-media">...</blockquote>',
  width: 658,
  height: null,
  duration_seconds: null,
  post_type: 'reel',
  error: null,
};

export const OEMBED_INSTAGRAM_FAILURE = {
  success: false,
  platform: 'instagram',
  video_id: null,
  title: null,
  author_name: null,
  author_url: null,
  thumbnail_url: null,
  thumbnail_width: null,
  thumbnail_height: null,
  html: null,
  width: null,
  height: null,
  duration_seconds: null,
  post_type: null,
  error: 'Instagram oEmbed requires authentication',
};

// ---------------------------------------------------------------------------
// Cache API responses
// ---------------------------------------------------------------------------

export const CACHE_MISS_RESPONSE = {
  cached: false,
  cache_entry: null,
};

// ---------------------------------------------------------------------------
// Apify ingest API responses
// ---------------------------------------------------------------------------

export const APIFY_INGEST_SUCCESS = {
  title: 'Full Body HIIT in 15 Minutes',
  workout_type: 'hiit',
  workout_type_confidence: 0.92,
  blocks: [
    {
      label: 'Warm-Up',
      structure: 'circuit',
      rounds: 1,
      exercises: [
        {
          name: 'Jumping Jacks',
          duration_sec: 30,
          sets: 1,
          reps: undefined,
          type: 'warmup',
          video_start_sec: 10,
          video_end_sec: 40,
        },
        {
          name: 'High Knees',
          duration_sec: 30,
          sets: 1,
          reps: undefined,
          type: 'warmup',
          video_start_sec: 40,
          video_end_sec: 70,
        },
      ],
      time_rest_sec: 0,
    },
    {
      label: 'Main Circuit',
      structure: 'circuit',
      rounds: 3,
      exercises: [
        {
          name: 'Burpees',
          duration_sec: 45,
          sets: 1,
          reps: 10,
          type: 'cardio',
          video_start_sec: 80,
          video_end_sec: 125,
        },
        {
          name: 'Mountain Climbers',
          duration_sec: 30,
          sets: 1,
          reps: undefined,
          type: 'cardio',
          video_start_sec: 130,
          video_end_sec: 160,
        },
        {
          name: 'Squat Jumps',
          duration_sec: 30,
          sets: 1,
          reps: 12,
          type: 'strength',
          video_start_sec: 165,
          video_end_sec: 195,
        },
      ],
      time_rest_sec: 15,
    },
  ],
  _provenance: {
    mode: 'apify_transcript',
    source_url: INSTAGRAM_REEL_URL,
    shortcode: 'C1234567890',
    creator: 'fitnessguru',
    video_duration_sec: 900,
    had_transcript: true,
    extraction_method: 'gpt-4o-mini',
  },
};

export const APIFY_INGEST_FAILURE = {
  detail: 'Apify actor timed out after 60s',
};

// ---------------------------------------------------------------------------
// Follow-along create manual API response
// ---------------------------------------------------------------------------

export const CREATE_FOLLOW_ALONG_SUCCESS = {
  followAlongWorkout: {
    id: 'fa-apify-test-001',
    user_id: 'user_pro_test',
    source: 'instagram',
    source_url: INSTAGRAM_REEL_URL,
    title: 'Full Body HIIT in 15 Minutes',
    description: 'Workout by fitnessguru',
    created_at: '2026-02-10T10:00:00Z',
    updated_at: '2026-02-10T10:00:00Z',
    video_duration_sec: 900,
    thumbnail_url: null,
    video_proxy_url: null,
    steps: [
      { id: 's1', order: 0, label: 'Jumping Jacks', duration_sec: 30 },
      { id: 's2', order: 1, label: 'High Knees', duration_sec: 30 },
      { id: 's3', order: 2, label: 'Burpees', duration_sec: 45, target_reps: 10 },
      { id: 's4', order: 3, label: 'Mountain Climbers', duration_sec: 30 },
      { id: 's5', order: 4, label: 'Squat Jumps', duration_sec: 30, target_reps: 12 },
    ],
  },
};

// ---------------------------------------------------------------------------
// TikTok URL constant (for regression tests)
// ---------------------------------------------------------------------------

export const TIKTOK_URL = 'https://www.tiktok.com/@fitnessguru/video/7123456789012345678';

// ---------------------------------------------------------------------------
// Generate Structure API responses (returned by the server after
// processing sources through the Apify / transcript / vision pipeline)
// ---------------------------------------------------------------------------

/**
 * Simple generate-structure response (no supersets).
 * Used by smoke tests for basic flow validation.
 */
export const GENERATE_STRUCTURE_RESPONSE_SIMPLE = {
  title: 'Instagram HIIT Workout',
  workout_type: 'hiit',
  blocks: [
    {
      label: 'Warm-Up',
      structure: 'circuit',
      rounds: 1,
      exercises: [
        { name: 'Jumping Jacks', duration_sec: 30, sets: 1, type: 'warmup' },
        { name: 'High Knees', duration_sec: 30, sets: 1, type: 'warmup' },
      ],
    },
    {
      label: 'Main Circuit',
      structure: 'circuit',
      rounds: 3,
      exercises: [
        { name: 'Burpees', duration_sec: 45, sets: 1, reps: 10, type: 'cardio' },
        { name: 'Mountain Climbers', duration_sec: 30, sets: 1, type: 'cardio' },
      ],
    },
  ],
};

/**
 * Generate-structure response WITH supersets.
 * Used to test the critical superset rendering flow (Flow 4).
 *
 * Structure: Block "Strength Supersets" contains 2 superset groups.
 * Each superset has 2 exercises. The exercises should appear ONLY inside
 * the superset containers, NOT duplicated as standalone block exercises.
 */
export const GENERATE_STRUCTURE_RESPONSE_WITH_SUPERSETS = {
  title: 'Instagram Strength Supersets',
  workout_type: 'strength',
  blocks: [
    {
      label: 'Warm-Up',
      structure: 'circuit',
      rounds: 1,
      exercises: [
        { name: 'Arm Circles', duration_sec: 30, sets: 1, type: 'warmup' },
        { name: 'Leg Swings', duration_sec: 30, sets: 1, type: 'warmup' },
      ],
      supersets: [],
    },
    {
      label: 'Strength Supersets',
      structure: 'superset',
      rounds: 3,
      exercises: [],
      supersets: [
        {
          id: 'ss-1',
          exercises: [
            { name: 'Bench Press', sets: 4, reps: 8, type: 'strength' },
            { name: 'Bent Over Row', sets: 4, reps: 8, type: 'strength' },
          ],
          rest_between_sec: 90,
        },
        {
          id: 'ss-2',
          exercises: [
            { name: 'Overhead Press', sets: 3, reps: 10, type: 'strength' },
            { name: 'Pull-Ups', sets: 3, reps: 8, type: 'strength' },
          ],
          rest_between_sec: 60,
        },
      ],
    },
    {
      label: 'Cool-Down',
      structure: null,
      exercises: [
        { name: 'Chest Stretch', duration_sec: 30, type: 'cooldown' },
        { name: 'Lat Stretch', duration_sec: 30, type: 'cooldown' },
      ],
      supersets: [],
    },
  ],
};

// ---------------------------------------------------------------------------
// Video detect response for YouTube (used in regression/non-regression tests)
// ---------------------------------------------------------------------------

export const DETECT_YOUTUBE_RESPONSE = {
  platform: 'youtube',
  video_id: 'dQw4w9WgXcQ',
  normalized_url: YOUTUBE_URL,
  original_url: YOUTUBE_URL,
  post_type: 'video',
};

export const DETECT_TIKTOK_RESPONSE = {
  platform: 'tiktok',
  video_id: '7123456789012345678',
  normalized_url: TIKTOK_URL,
  original_url: TIKTOK_URL,
  post_type: 'video',
};

// ---------------------------------------------------------------------------
// Response builders
// ---------------------------------------------------------------------------

export function buildApifySuccessResponse() {
  return APIFY_INGEST_SUCCESS;
}

export function buildApifyFailureResponse(detail = 'Apify actor timed out after 60s') {
  return { detail };
}

export function buildCacheMissResponse() {
  return CACHE_MISS_RESPONSE;
}

export function buildOEmbedSuccessResponse() {
  return OEMBED_INSTAGRAM_SUCCESS;
}

export function buildOEmbedFailureResponse() {
  return OEMBED_INSTAGRAM_FAILURE;
}

export function buildGenerateStructureResponse(withSupersets = false) {
  return withSupersets
    ? GENERATE_STRUCTURE_RESPONSE_WITH_SUPERSETS
    : GENERATE_STRUCTURE_RESPONSE_SIMPLE;
}
