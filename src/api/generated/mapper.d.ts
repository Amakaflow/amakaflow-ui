// @generated — do not edit by hand.
// Regenerate with: npm run generate:types:mapper (requires mapper-api running locally)
// Last generated: 2026-03-04

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
}

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
