// @generated — do not edit by hand.
// Regenerate with: npm run generate:types:ingestor (requires ingestor-api running locally)
// Last generated: 2026-03-04

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
