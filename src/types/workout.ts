// API Request/Response Types matching the actual backend

export interface Exercise {
  id: string; // Industry-standard: required for stable drag-and-drop
  name: string;
  sets: number | null;
  reps: number | null;
  reps_range: string | null;
  duration_sec: number | null;
  rest_sec: number | null; // Rest after this exercise (only used in 'regular' structure)
  distance_m: number | null;
  distance_range: string | null;
  type: 'strength' | 'cardio' | 'HIIT' | 'interval' | string;
  followAlongUrl?: string | null; // Instagram, TikTok, YouTube, or any video URL for this exercise
  notes?: string | null;
  addedAt?: number; // Timestamp when exercise was added (can be used upstream to seed initial order)
}

export type WorkoutStructureType = 
  | 'superset'    // 2 exercises back to back, no rest between, rest after pair
  | 'circuit'     // Multiple exercises back to back, no rest between, rest after circuit
  | 'tabata'      // Work/rest intervals (typically 20s work, 10s rest)
  | 'emom'        // Every Minute On the Minute
  | 'amrap'       // As Many Rounds As Possible
  | 'for-time'    // Complete as fast as possible
  | 'rounds'      // Fixed number of rounds
  | 'sets'        // Fixed number of sets with rest between
  | 'regular';    // Standard workout with rest between exercises

export interface Block {
  id?: string; // Unique ID for drag-and-drop stability
  label: string;
  structure: WorkoutStructureType | null;
  
  // Block-level exercises (exercises directly in the block, outside of supersets)
  exercises: Exercise[];
  
  // Supersets (nested containers that hold exercises)
  // A block can have both exercises and supersets simultaneously
  supersets?: Superset[];
  
  // Structure-specific parameters
  rounds?: number | null;              // For 'rounds' structure: number of rounds
  sets?: number | null;                // For 'sets' structure: number of sets
  time_cap_sec?: number | null;         // For 'amrap' and 'for-time': time limit in seconds
  time_work_sec?: number | null;        // For 'tabata' and 'emom': work time in seconds
  time_rest_sec?: number | null;        // For 'tabata': rest time in seconds
  
  // Rest periods
  rest_between_rounds_sec?: number | null;  // Rest between rounds (for 'rounds', 'circuit', 'superset')
  rest_between_sets_sec?: number | null;    // Rest between sets (for 'sets' structure)
  
  // Legacy fields for backward compatibility (deprecated)
  rest_between_sec?: number | null;          // Alias for rest_between_rounds_sec
  default_reps_range?: string | null;        // Deprecated
  default_sets?: number | null;             // Deprecated
}

// Superset interface - containers within blocks that hold exercises
export interface Superset {
  id: string; // Industry-standard: required for stable drag-and-drop
  exercises: Exercise[];
  rest_between_sec?: number | null; // Rest after completing all exercises in the superset
}

export interface WorkoutStructure {
  title: string;
  source: string;
  blocks: Block[];
}

export interface BlocksJson {
  blocks_json: WorkoutStructure;
}

// Validation Types
export interface ExerciseSuggestion {
  name: string;
  score: number;
  normalized: string;
  keyword?: string;
}

// New format: simple list of {name, confidence} tuples from exercise_name_matcher
export interface Suggestion {
  name: string;
  confidence: number;
}

// Legacy format (kept for backward compatibility)
export interface ValidationSuggestions {
  similar: ExerciseSuggestion[];
  by_type: ExerciseSuggestion[];
  category: string | null;
  needs_user_search: boolean;
}

export interface ValidationResult {
  original_name: string;
  mapped_to: string | null;
  mapped_name?: string | null; // New field from backend (same as mapped_to)
  confidence: number;
  description: string;
  block: string;
  location: string;
  status: 'valid' | 'needs_review' | 'unmapped';
  // New format: list of {name, confidence} tuples
  suggestions: Suggestion[];
  // Legacy format (optional, for backward compatibility)
  suggestions_legacy?: ValidationSuggestions;
}

export interface ValidationResponse {
  total_exercises: number;
  validated_exercises: ValidationResult[];
  needs_review: ValidationResult[];
  unmapped_exercises: ValidationResult[];
  can_proceed: boolean;
}

// Export Formats
export interface ExportFormats {
  yaml: string;
  fit?: string;
  plist?: string;
  zwo?: string;
}

// Workflow Response
export interface WorkflowProcessResponse {
  validation: ValidationResponse;
  yaml: string | null;
  message: string;
}

// Exercise Suggestion Response
export interface ExerciseSuggestResponse {
  input: string;
  best_match: {
    name: string;
    score: number;
    is_exact: boolean;
  } | null;
  similar_exercises: ExerciseSuggestion[];
  exercises_by_type: ExerciseSuggestion[];
  category: string | null;
  needs_user_search: boolean;
}

// Mapping Types
export interface ExerciseMapping {
  exercise_name: string;
  garmin_name: string;
  created_at?: string;
}

export interface MappingResponse {
  message: string;
  mapping: ExerciseMapping;
}

export interface MappingLookupResponse {
  exercise_name: string;
  mapped_to: string | null;
  exists: boolean;
}

// Source Types (for UI)
export type SourceType = 'instagram' | 'youtube' | 'image' | 'ai-text';

export interface Source {
  id: string;
  type: SourceType;
  content: string;
  timestamp: Date;
}
