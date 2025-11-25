export type CanonicalExerciseRef = {
  id: string;
  name: string;
  muscleGroups: string[];
};

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
};

export type FollowAlongWorkout = {
  id: string;
  userId: string;
  source: "instagram";
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





