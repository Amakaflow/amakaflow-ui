// @generated — do not edit by hand.
// Regenerate with: npm run generate:types:ingestor (requires ingestor-api running locally)

// openapi-typescript paths interface (used by _Verify type assertions in schemas/ingestor.ts)
export interface paths {
  '/ingest/ai_workout': {
    post: {
      responses: {
        200: {
          content: {
            'application/json': IngestorWorkoutStructure;
          };
        };
      };
    };
  };
}

// Pipeline-layer types (minimal fields consumed by runIngestionPipeline)
export interface IngestorExercise {
  name: string;
  sets?: number | null;
  reps?: number | null;
  duration_sec?: number | null;
  rest_sec?: number | null;
  weight_kg?: number | null;
  notes?: string | null;
}

export interface IngestorBlock {
  label: string;
  structure?: string | null;
  exercises: IngestorExercise[];
}

export interface IngestorWorkoutStructure {
  title: string;
  blocks: IngestorBlock[];
  source?: string;
  workout_type?: string | null;
  workout_type_confidence?: number | null;
}

// Full client-layer types (used by WorkoutStructureResponseSchema)
export interface WorkoutStructureResponse {
  title?: string;
  source?: string;
  blocks: Block[];
  workout_type?: string;
  workout_type_confidence?: number;
}

interface Block {
  label?: string;
  structure?: string | null;
  exercises: Exercise[];
  supersets?: Superset[];
  sets?: number | null;
  rounds?: number | null;
  rest_between_sets_sec?: number | null;
  rest_between_rounds_sec?: number | null;
  time_cap_sec?: number | null;
}

interface Exercise {
  name: string;
  sets?: number | null;
  reps?: number | null;
  reps_range?: string | null;
  duration_sec?: number | null;
  rest_sec?: number | null;
  distance_m?: number | null;
  type?: string;
}

interface Superset {
  exercises: Exercise[];
  rest_between_sec?: number | null;
}
