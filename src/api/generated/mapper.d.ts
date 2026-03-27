// @generated — do not edit by hand.
// Regenerate with: npm run generate:types:mapper (requires mapper-api running locally)

// openapi-typescript paths interface (used by _Verify type assertions in schemas/mapper.ts)
export interface paths {
  '/validate': {
    post: {
      responses: {
        200: {
          content: {
            'application/json': MapperValidationResponse;
          };
        };
      };
    };
  };
  '/exercises/match': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            exercises: string[];
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': MapperValidationResponse;
          };
        };
      };
    };
  };
}

// Pipeline-layer types (consumed by runIngestionPipeline via ValidationResponseSchema)
export interface MapperExerciseMatch {
  original_name: string;
  matched_name: string | null;
  confidence: number;
  garmin_id: string | null;
}

export interface MapperValidationResponse {
  success: boolean;
  matches: MapperExerciseMatch[];
  unmapped: string[];
}

// Full client-layer types (used by SavedWorkoutSchema, WorkoutProgramSchema, UserTagSchema)
export interface SavedWorkout {
  id: string;
  profile_id: string;
  workout_data: Record<string, unknown>;
  sources: string[];
  device?: string;
  exports?: Record<string, unknown>;
  validation?: Record<string, unknown>;
  title?: string;
  description?: string;
  is_favorite?: boolean;
  is_exported: boolean;
  exported_at?: string;
  exported_to_device?: string;
  synced_to_strava?: boolean;
  strava_activity_id?: string;
  ios_companion_synced_at?: string;
  android_companion_synced_at?: string;
  sync_status?: {
    ios?: SyncStatusEntry;
    android?: SyncStatusEntry;
    garmin?: SyncStatusEntry;
  };
  created_at: string;
  updated_at: string;
}

export interface SyncStatusEntry {
  status: string;
  queued_at?: string;
  synced_at?: string;
  failed_at?: string;
  error_message?: string;
}

export interface WorkoutProgram {
  id: string;
  profile_id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  current_day_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  members?: ProgramMember[];
}

export interface ProgramMember {
  id: string;
  program_id: string;
  workout_id?: string;
  follow_along_id?: string;
  day_order: number;
  created_at: string;
}

export interface UserTag {
  id: string;
  profile_id: string;
  name: string;
  color?: string;
  created_at: string;
}

export interface SaveWorkoutsResponse {
  success: boolean;
  workout_id: string;
  message: string;
}

export interface GetWorkoutsResponse {
  success: boolean;
  workouts: SavedWorkout[];
  count: number;
}

export interface GetProgramsResponse {
  success: boolean;
  programs: WorkoutProgram[];
  count: number;
}

export interface GetTagsResponse {
  success: boolean;
  tags: UserTag[];
  count: number;
}
