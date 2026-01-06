export type CanonicalExerciseRef = {
  id: string;
  name: string;
  muscleGroups: string[];
};

export type VideoPlatform = 'instagram' | 'youtube' | 'tiktok' | 'vimeo' | 'other';

export type FollowAlongStep = {
  id: string;
  order: number;
  label: string;
  canonicalExerciseId?: string;
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
  targetReps?: number;
  targetDurationSec?: number;
  intensityHint?: "easy" | "moderate" | "hard";
  notes?: string;
  // Video reference for this specific step
  followAlongUrl?: string;
  carouselPosition?: number; // For Instagram carousels - which slide to show
  videoStartTimeSec?: number; // For YouTube/Vimeo - timestamp to start at
};

export type FollowAlongWorkout = {
  id: string;
  userId: string;
  source: VideoPlatform;
  sourceUrl: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  videoDurationSec?: number;
  thumbnailUrl?: string;
  videoProxyUrl?: string;
  steps: FollowAlongStep[];
  garminWorkoutId?: string;
  garminLastSyncAt?: string | null;
  appleWatchWorkoutId?: string;
  appleWatchLastSyncAt?: string | null;
  iosCompanionSyncedAt?: string | null; // When synced to iOS companion app
};

export type IngestFollowAlongRequest = {
  instagramUrl: string;
};

export type IngestFollowAlongResponse = {
  followAlongWorkout: FollowAlongWorkout;
};

export type ListFollowAlongResponse = {
  items: FollowAlongWorkout[];
};

export type GetFollowAlongResponse = {
  followAlongWorkout: FollowAlongWorkout;
};

export type PushToGarminResponse = {
  status: "success" | "error";
  garminWorkoutId?: string;
  message?: string;
  alreadySynced?: boolean;
};

export type PushToAppleWatchResponse = {
  status: "success" | "error";
  appleWatchWorkoutId?: string;
  payload?: {
    id: string;
    title: string;
    steps: Array<{
      order: number;
      label: string;
      durationSec: number;
    }>;
  };
  message?: string;
};

// iOS Companion App sync - includes full video URLs for follow-along flow
export type PushToIOSCompanionRequest = {
  userId: string;
};

export type IOSCompanionWorkoutPayload = {
  id: string;
  name: string;
  sport: 'strength' | 'cardio' | 'mobility' | 'other';
  duration: number; // seconds
  source: VideoPlatform;
  sourceUrl?: string;
  intervals: IOSCompanionInterval[];
};

export type IOSCompanionInterval = {
  kind?: 'warmup' | 'cooldown' | 'time' | 'reps' | 'distance' | 'repeat' | 'rest';
  type?: string;  // Android sends 'type' instead of 'kind'
  seconds?: number;
  target?: string;
  reps?: number;
  name?: string;
  load?: string;
  restSec?: number;
  meters?: number;
  intervals?: IOSCompanionInterval[]; // For repeat blocks
  followAlongUrl?: string;
  carouselPosition?: number;
};

export type PushToIOSCompanionResponse = {
  status: "success" | "error";
  iosCompanionWorkoutId?: string;
  payload?: IOSCompanionWorkoutPayload;
  message?: string;
};





