import { WorkoutStructure } from '../types/workout';
import { addIdsToWorkout } from './workout-utils';

/**
 * Sample HYROX workout for initialization
 */
export const SAMPLE_HYROX_WORKOUT: WorkoutStructure = {
  title: "HYROX Training Workout",
  source: "sample",
  blocks: [
    {
      label: "Superset 1",
      structure: "superset",
      exercises: [
        {
          name: "Wall Balls",
          sets: null,
          reps: 15,
          reps_range: null,
          duration_sec: null,
          rest_sec: null,
          distance_m: null,
          distance_range: null,
          type: "strength",
          notes: null
        },
        {
          name: "Wall Balls",
          sets: null,
          reps: 25,
          reps_range: null,
          duration_sec: null,
          rest_sec: null,
          distance_m: null,
          distance_range: null,
          type: "strength",
          notes: null
        }
      ],
      rounds: 3,
      sets: null,
      time_cap_sec: null,
      time_work_sec: null,
      time_rest_sec: null,
      rest_between_rounds_sec: 60,
      rest_between_sets_sec: null
    },
    {
      label: "Run",
      structure: null,
      exercises: [
        {
          name: "Run",
          sets: null,
          reps: null,
          reps_range: null,
          duration_sec: null,
          rest_sec: null,
          distance_m: 1000,
          distance_range: null,
          type: "cardio",
          notes: null
        }
      ],
      rounds: null,
      sets: null,
      time_cap_sec: null,
      time_work_sec: null,
      time_rest_sec: null,
      rest_between_rounds_sec: null,
      rest_between_sets_sec: null
    },
    {
      label: "Full Body Circuit",
      structure: "circuit",
      exercises: [
        {
          name: "Burpees",
          sets: null,
          reps: 10,
          reps_range: null,
          duration_sec: null,
          rest_sec: null,
          distance_m: null,
          distance_range: null,
          type: "HIIT",
          notes: null
        },
        {
          name: "Pull-ups",
          sets: null,
          reps: 8,
          reps_range: null,
          duration_sec: null,
          rest_sec: null,
          distance_m: null,
          distance_range: null,
          type: "strength",
          notes: null
        },
        {
          name: "Squats",
          sets: null,
          reps: 15,
          reps_range: null,
          duration_sec: null,
          rest_sec: null,
          distance_m: null,
          distance_range: null,
          type: "strength",
          notes: null
        }
      ],
      rounds: 4,
      sets: null,
      time_cap_sec: null,
      time_work_sec: null,
      time_rest_sec: null,
      rest_between_rounds_sec: 90,
      rest_between_sets_sec: null
    },
    {
      label: "Tabata Finisher",
      structure: "tabata",
      exercises: [
        {
          name: "Mountain Climbers",
          sets: null,
          reps: null,
          reps_range: null,
          duration_sec: null,
          rest_sec: null,
          distance_m: null,
          distance_range: null,
          type: "HIIT",
          notes: null
        }
      ],
      rounds: 8,
      sets: null,
      time_cap_sec: null,
      time_work_sec: 20,
      time_rest_sec: 10,
      rest_between_rounds_sec: null,
      rest_between_sets_sec: null
    },
    {
      label: "20 Min AMRAP",
      structure: "amrap",
      exercises: [
        {
          name: "Burpees",
          sets: null,
          reps: 5,
          reps_range: null,
          duration_sec: null,
          rest_sec: null,
          distance_m: null,
          distance_range: null,
          type: "HIIT",
          notes: null
        },
        {
          name: "Pull-ups",
          sets: null,
          reps: 10,
          reps_range: null,
          duration_sec: null,
          rest_sec: null,
          distance_m: null,
          distance_range: null,
          type: "strength",
          notes: null
        },
        {
          name: "Squats",
          sets: null,
          reps: 15,
          reps_range: null,
          duration_sec: null,
          rest_sec: null,
          distance_m: null,
          distance_range: null,
          type: "strength",
          notes: null
        }
      ],
      rounds: null,
      sets: null,
      time_cap_sec: 1200,
      time_work_sec: null,
      time_rest_sec: null,
      rest_between_rounds_sec: 0,
      rest_between_sets_sec: null
    }
  ]
};

/**
 * Get initialized sample workout with IDs
 */
export function getInitializedSampleWorkout(): WorkoutStructure {
  return addIdsToWorkout(SAMPLE_HYROX_WORKOUT);
}





