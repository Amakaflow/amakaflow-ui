/**
 * JSON Schema definitions for Progression API contract tests.
 *
 * These schemas validate that mapper-api responses match the expected
 * structure that the TypeScript client transforms into application types.
 *
 * Schema definitions mirror the Pydantic models in:
 * mapper-api/api/routers/progression.py
 */

// =============================================================================
// Set Detail Schema
// =============================================================================

export const setDetailSchema = {
  $id: 'SetDetail',
  type: 'object',
  properties: {
    set_number: { type: 'integer', minimum: 1 },
    weight: { type: ['number', 'null'] },
    weight_unit: { type: 'string', enum: ['lbs', 'kg'] },
    reps_completed: { type: ['integer', 'null'], minimum: 0 },
    reps_planned: { type: ['integer', 'null'], minimum: 0 },
    status: { type: 'string', enum: ['completed', 'skipped', 'partial'] },
    estimated_1rm: { type: ['number', 'null'] },
    is_pr: { type: 'boolean' },
  },
  required: ['set_number', 'weight_unit', 'status', 'is_pr'],
  additionalProperties: false,
};

// =============================================================================
// Session Schema
// =============================================================================

export const sessionSchema = {
  $id: 'Session',
  type: 'object',
  properties: {
    completion_id: { type: 'string', minLength: 1 },
    workout_date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}' },
    workout_name: { type: ['string', 'null'] },
    exercise_name: { type: 'string', minLength: 1 },
    sets: {
      type: 'array',
      items: { $ref: 'SetDetail' },
    },
    session_best_1rm: { type: ['number', 'null'] },
    session_max_weight: { type: ['number', 'null'] },
    session_total_volume: { type: ['number', 'null'] },
  },
  required: ['completion_id', 'workout_date', 'exercise_name', 'sets'],
  additionalProperties: false,
};

// =============================================================================
// Exercise History Schema
// =============================================================================

export const exerciseHistorySchema = {
  $id: 'ExerciseHistory',
  type: 'object',
  properties: {
    exercise_id: {
      type: 'string',
      pattern: '^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$',
    },
    exercise_name: { type: 'string', minLength: 1 },
    supports_1rm: { type: 'boolean' },
    one_rm_formula: { type: 'string', enum: ['brzycki', 'epley', 'lander'] },
    sessions: {
      type: 'array',
      items: { $ref: 'Session' },
    },
    total_sessions: { type: 'integer', minimum: 0 },
    all_time_best_1rm: { type: ['number', 'null'] },
    all_time_max_weight: { type: ['number', 'null'] },
  },
  required: [
    'exercise_id',
    'exercise_name',
    'supports_1rm',
    'one_rm_formula',
    'sessions',
    'total_sessions',
  ],
  additionalProperties: false,
};

// =============================================================================
// Exercise With History Schema (list item)
// =============================================================================

export const exerciseWithHistorySchema = {
  $id: 'ExerciseWithHistory',
  type: 'object',
  properties: {
    exercise_id: {
      type: 'string',
      pattern: '^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$',
    },
    exercise_name: { type: 'string', minLength: 1 },
    session_count: { type: 'integer', minimum: 1 },
  },
  required: ['exercise_id', 'exercise_name', 'session_count'],
  additionalProperties: false,
};

export const exercisesWithHistoryResponseSchema = {
  $id: 'ExercisesWithHistoryResponse',
  type: 'object',
  properties: {
    exercises: {
      type: 'array',
      items: { $ref: 'ExerciseWithHistory' },
    },
    total: { type: 'integer', minimum: 0 },
  },
  required: ['exercises', 'total'],
  additionalProperties: false,
};

// =============================================================================
// Personal Record Schema
// =============================================================================

export const personalRecordItemSchema = {
  $id: 'PersonalRecordItem',
  type: 'object',
  properties: {
    exercise_id: { type: 'string', minLength: 1 },
    exercise_name: { type: 'string', minLength: 1 },
    record_type: { type: 'string', enum: ['1rm', 'max_weight', 'max_reps'] },
    value: { type: 'number' },
    unit: { type: 'string', enum: ['lbs', 'kg', 'reps'] },
    achieved_at: { type: ['string', 'null'] },
    completion_id: { type: ['string', 'null'] },
    details: { type: ['object', 'null'] },
  },
  required: ['exercise_id', 'exercise_name', 'record_type', 'value', 'unit'],
  additionalProperties: false,
};

export const personalRecordsResponseSchema = {
  $id: 'PersonalRecordsResponse',
  type: 'object',
  properties: {
    records: {
      type: 'array',
      items: { $ref: 'PersonalRecordItem' },
    },
    exercise_id: { type: ['string', 'null'] },
  },
  required: ['records'],
  additionalProperties: false,
};

// =============================================================================
// Last Weight Schema
// =============================================================================

export const lastWeightSchema = {
  $id: 'LastWeight',
  type: 'object',
  properties: {
    exercise_id: { type: 'string', minLength: 1 },
    exercise_name: { type: 'string', minLength: 1 },
    weight: { type: 'number', minimum: 0 },
    weight_unit: { type: 'string', enum: ['lbs', 'kg'] },
    reps_completed: { type: 'integer', minimum: 0 },
    workout_date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}' },
    completion_id: { type: 'string', minLength: 1 },
  },
  required: [
    'exercise_id',
    'exercise_name',
    'weight',
    'weight_unit',
    'reps_completed',
    'workout_date',
    'completion_id',
  ],
  additionalProperties: false,
};

// =============================================================================
// Volume Analytics Schema
// =============================================================================

export const volumeDataPointSchema = {
  $id: 'VolumeDataPoint',
  type: 'object',
  properties: {
    period: { type: 'string' },
    muscle_group: { type: 'string', minLength: 1 },
    total_volume: { type: 'number', minimum: 0 },
    total_sets: { type: 'integer', minimum: 0 },
    total_reps: { type: 'integer', minimum: 0 },
  },
  required: ['period', 'muscle_group', 'total_volume', 'total_sets', 'total_reps'],
  additionalProperties: false,
};

export const volumeSummarySchema = {
  $id: 'VolumeSummary',
  type: 'object',
  properties: {
    total_volume: { type: 'number', minimum: 0 },
    total_sets: { type: 'integer', minimum: 0 },
    total_reps: { type: 'integer', minimum: 0 },
    muscle_group_breakdown: {
      type: 'object',
      additionalProperties: { type: 'number' },
    },
  },
  required: ['total_volume', 'total_sets', 'total_reps', 'muscle_group_breakdown'],
  additionalProperties: false,
};

export const volumeAnalyticsResponseSchema = {
  $id: 'VolumeAnalyticsResponse',
  type: 'object',
  properties: {
    data: {
      type: 'array',
      items: { $ref: 'VolumeDataPoint' },
    },
    summary: { $ref: 'VolumeSummary' },
    period: {
      type: 'object',
      properties: {
        start_date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}' },
        end_date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}' },
      },
      required: ['start_date', 'end_date'],
    },
    granularity: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
  },
  required: ['data', 'summary', 'period', 'granularity'],
  additionalProperties: false,
};

// =============================================================================
// Error Response Schema
// =============================================================================

export const errorResponseSchema = {
  $id: 'ErrorResponse',
  type: 'object',
  properties: {
    detail: {
      oneOf: [
        { type: 'string' },
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              loc: { type: 'array', items: { type: ['string', 'integer'] } },
              msg: { type: 'string' },
              type: { type: 'string' },
            },
            required: ['loc', 'msg', 'type'],
          },
        },
      ],
    },
  },
  required: ['detail'],
};

// =============================================================================
// Schema Registry (for AJV)
// =============================================================================

export const allSchemas = [
  setDetailSchema,
  sessionSchema,
  exerciseHistorySchema,
  exerciseWithHistorySchema,
  exercisesWithHistoryResponseSchema,
  personalRecordItemSchema,
  personalRecordsResponseSchema,
  lastWeightSchema,
  volumeDataPointSchema,
  volumeSummarySchema,
  volumeAnalyticsResponseSchema,
  errorResponseSchema,
];
