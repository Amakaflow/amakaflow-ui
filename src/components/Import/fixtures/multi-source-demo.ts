/**
 * AMA-1180: Demo mock data for multi-source workout import.
 *
 * 5 mixed-source imports:
 *   - 2 Instagram Reels (mobility exercises)
 *   - 2 YouTube clips (strength exercises)
 *   - 1 TikTok (HYROX drill)
 *
 * Each has realistic blocks, exercises, video URLs, and timestamps.
 */

import type { QueueItem, ProcessedItem } from '../../../types/import';

export type SourcePlatform = 'instagram' | 'youtube' | 'tiktok';

export interface VideoSegment {
  url: string;
  platform: SourcePlatform;
  startSec: number;
  endSec: number;
  thumbnailUrl?: string;
}

export interface MultiSourceBlock {
  id: string;
  label: string;
  source: SourcePlatform;
  sourceUrl: string;
  videoSegment?: VideoSegment;
  exercises: Array<{
    name: string;
    sets?: number;
    reps?: number | string;
    duration_sec?: number;
  }>;
}

// ── Platform detection ───────────────────────────────────────────────────────

export function detectPlatform(url: string): SourcePlatform | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('instagram.com') || hostname.includes('instagr.am')) return 'instagram';
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube';
    if (hostname.includes('tiktok.com')) return 'tiktok';
    return null;
  } catch {
    return null;
  }
}

export const PLATFORM_COLORS: Record<SourcePlatform, string> = {
  instagram: 'bg-gradient-to-r from-purple-500 to-pink-500',
  youtube: 'bg-red-600',
  tiktok: 'bg-black',
};

export const PLATFORM_BADGE_COLORS: Record<SourcePlatform, string> = {
  instagram: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  youtube: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  tiktok: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300',
};

export const PLATFORM_LABELS: Record<SourcePlatform, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};

// ── Demo queue items ─────────────────────────────────────────────────────────

export const DEMO_QUEUE_ITEMS: QueueItem[] = [
  {
    id: 'demo-ig-1',
    type: 'url',
    label: 'instagram.com/reel/CxMobility01',
    raw: 'https://www.instagram.com/reel/CxMobility01/',
  },
  {
    id: 'demo-ig-2',
    type: 'url',
    label: 'instagram.com/reel/CxMobility02',
    raw: 'https://www.instagram.com/reel/CxMobility02/',
  },
  {
    id: 'demo-yt-1',
    type: 'url',
    label: 'youtu.be/StrengthUpper01',
    raw: 'https://www.youtube.com/watch?v=StrengthUpper01',
  },
  {
    id: 'demo-yt-2',
    type: 'url',
    label: 'youtu.be/StrengthLower01',
    raw: 'https://www.youtube.com/watch?v=StrengthLower01',
  },
  {
    id: 'demo-tt-1',
    type: 'url',
    label: 'tiktok.com/@hyroxcoach/video/123',
    raw: 'https://www.tiktok.com/@hyroxcoach/video/7298765432100',
  },
];

// ── Demo processed items with realistic blocks ───────────────────────────────

export const DEMO_PROCESSED_ITEMS: ProcessedItem[] = [
  {
    queueId: 'demo-ig-1',
    status: 'done',
    workoutTitle: 'Morning Mobility Flow',
    blockCount: 2,
    exerciseCount: 6,
    sourceIcon: 'instagram',
    workout: {
      title: 'Morning Mobility Flow',
      blocks: [
        {
          id: 'ig1-block-1',
          label: 'Hip & Ankle Mobility',
          exercises: [
            { name: '90/90 Hip Switch', sets: 2, reps: '8 each', duration_sec: undefined },
            { name: 'World\'s Greatest Stretch', sets: 2, reps: '5 each', duration_sec: undefined },
            { name: 'Ankle CARs', duration_sec: 30 },
          ],
        },
        {
          id: 'ig1-block-2',
          label: 'Thoracic Spine',
          exercises: [
            { name: 'Open Book Rotation', sets: 2, reps: '8 each', duration_sec: undefined },
            { name: 'Cat-Cow', sets: 1, reps: 10 },
            { name: 'Thread the Needle', sets: 2, reps: '6 each', duration_sec: undefined },
          ],
        },
      ],
      sourceUrl: 'https://www.instagram.com/reel/CxMobility01/',
      platform: 'instagram',
    },
  },
  {
    queueId: 'demo-ig-2',
    status: 'done',
    workoutTitle: 'Pre-Workout Activation',
    blockCount: 1,
    exerciseCount: 4,
    sourceIcon: 'instagram',
    workout: {
      title: 'Pre-Workout Activation',
      blocks: [
        {
          id: 'ig2-block-1',
          label: 'Glute & Core Activation',
          exercises: [
            { name: 'Banded Clamshell', sets: 2, reps: 15 },
            { name: 'Dead Bug', sets: 2, reps: '8 each' },
            { name: 'Bird Dog', sets: 2, reps: '8 each' },
            { name: 'Glute Bridge Hold', duration_sec: 30 },
          ],
        },
      ],
      sourceUrl: 'https://www.instagram.com/reel/CxMobility02/',
      platform: 'instagram',
    },
  },
  {
    queueId: 'demo-yt-1',
    status: 'done',
    workoutTitle: 'Upper Body Strength - Push/Pull',
    blockCount: 2,
    exerciseCount: 8,
    sourceIcon: 'youtube',
    workout: {
      title: 'Upper Body Strength - Push/Pull',
      blocks: [
        {
          id: 'yt1-block-1',
          label: 'Push Superset',
          exercises: [
            { name: 'Bench Press', sets: 4, reps: 6 },
            { name: 'Overhead Press', sets: 4, reps: 8 },
            { name: 'Incline DB Fly', sets: 3, reps: 12 },
            { name: 'Lateral Raise', sets: 3, reps: 15 },
          ],
        },
        {
          id: 'yt1-block-2',
          label: 'Pull Superset',
          exercises: [
            { name: 'Weighted Pull-ups', sets: 4, reps: 6 },
            { name: 'Barbell Row', sets: 4, reps: 8 },
            { name: 'Face Pull', sets: 3, reps: 15 },
            { name: 'Bicep Curl', sets: 3, reps: 12 },
          ],
        },
      ],
      sourceUrl: 'https://www.youtube.com/watch?v=StrengthUpper01',
      platform: 'youtube',
    },
  },
  {
    queueId: 'demo-yt-2',
    status: 'done',
    workoutTitle: 'Lower Body Strength - Squat Focus',
    blockCount: 2,
    exerciseCount: 7,
    sourceIcon: 'youtube',
    workout: {
      title: 'Lower Body Strength - Squat Focus',
      blocks: [
        {
          id: 'yt2-block-1',
          label: 'Main Lifts',
          exercises: [
            { name: 'Back Squat', sets: 5, reps: 5 },
            { name: 'Romanian Deadlift', sets: 4, reps: 8 },
            { name: 'Walking Lunge', sets: 3, reps: '10 each' },
          ],
        },
        {
          id: 'yt2-block-2',
          label: 'Accessories',
          exercises: [
            { name: 'Leg Press', sets: 3, reps: 12 },
            { name: 'Leg Curl', sets: 3, reps: 12 },
            { name: 'Calf Raise', sets: 4, reps: 15 },
            { name: 'Ab Wheel Rollout', sets: 3, reps: 10 },
          ],
        },
      ],
      sourceUrl: 'https://www.youtube.com/watch?v=StrengthLower01',
      platform: 'youtube',
    },
  },
  {
    queueId: 'demo-tt-1',
    status: 'done',
    workoutTitle: 'HYROX Sled & Wall Ball Drill',
    blockCount: 1,
    exerciseCount: 5,
    sourceIcon: 'tiktok',
    workout: {
      title: 'HYROX Sled & Wall Ball Drill',
      blocks: [
        {
          id: 'tt1-block-1',
          label: 'HYROX Station Circuit',
          exercises: [
            { name: 'Sled Push', sets: 4, duration_sec: 60 },
            { name: 'Wall Balls', sets: 4, reps: 20 },
            { name: 'Sled Pull', sets: 4, duration_sec: 60 },
            { name: 'Burpee Broad Jump', sets: 4, reps: 10 },
            { name: 'Sandbag Lunge', sets: 4, reps: '10 each' },
          ],
        },
      ],
      sourceUrl: 'https://www.tiktok.com/@hyroxcoach/video/7298765432100',
      platform: 'tiktok',
    },
  },
];

// ── Demo video segments (for follow-along merge) ─────────────────────────────

export const DEMO_VIDEO_SEGMENTS: Record<string, VideoSegment> = {
  'ig1-block-1': {
    url: 'https://www.instagram.com/reel/CxMobility01/',
    platform: 'instagram',
    startSec: 0,
    endSec: 45,
  },
  'ig1-block-2': {
    url: 'https://www.instagram.com/reel/CxMobility01/',
    platform: 'instagram',
    startSec: 45,
    endSec: 90,
  },
  'ig2-block-1': {
    url: 'https://www.instagram.com/reel/CxMobility02/',
    platform: 'instagram',
    startSec: 0,
    endSec: 60,
  },
  'yt1-block-1': {
    url: 'https://www.youtube.com/watch?v=StrengthUpper01',
    platform: 'youtube',
    startSec: 0,
    endSec: 300,
  },
  'yt1-block-2': {
    url: 'https://www.youtube.com/watch?v=StrengthUpper01',
    platform: 'youtube',
    startSec: 300,
    endSec: 600,
  },
  'yt2-block-1': {
    url: 'https://www.youtube.com/watch?v=StrengthLower01',
    platform: 'youtube',
    startSec: 0,
    endSec: 240,
  },
  'yt2-block-2': {
    url: 'https://www.youtube.com/watch?v=StrengthLower01',
    platform: 'youtube',
    startSec: 240,
    endSec: 480,
  },
  'tt1-block-1': {
    url: 'https://www.tiktok.com/@hyroxcoach/video/7298765432100',
    platform: 'tiktok',
    startSec: 0,
    endSec: 55,
  },
};
