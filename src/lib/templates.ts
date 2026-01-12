import { WorkoutStructure } from '../types/workout';

/**
 * Workout Template Categories (AMA-313)
 * Used for grouping templates in the UI
 */
export type TemplateCategory =
  | 'strength'      // Traditional strength workouts
  | 'hiit'          // HIIT / Interval training
  | 'quick'         // Quick workouts (10-15 min)
  | 'emom-amrap'    // EMOM / AMRAP style
  | 'focus'         // Single body part focus
  | 'cardio'        // Cardio / Race simulation
  | 'superset';     // Superset-based workouts

export interface CategorizedWorkoutStructure extends WorkoutStructure {
  category: TemplateCategory;
  duration?: string;  // e.g., "~35 min", "20 min"
}

export const templateCategoryLabels: Record<TemplateCategory, string> = {
  'strength': 'Traditional Strength',
  'hiit': 'HIIT / Interval',
  'quick': 'Quick Workouts',
  'emom-amrap': 'EMOM / AMRAP',
  'focus': 'Single Body Part',
  'cardio': 'Cardio / Race',
  'superset': 'Supersets',
};

// Helper to create exercise with all required fields
const ex = (
  name: string,
  opts: {
    sets?: number | null;
    reps?: number | null;
    reps_range?: string | null;
    duration_sec?: number | null;
    rest_sec?: number | null;
    distance_m?: number | null;
    type?: string;
    notes?: string | null;
  } = {}
) => ({
  id: `ex-${name.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).substr(2, 6)}`,
  name,
  sets: opts.sets ?? null,
  reps: opts.reps ?? null,
  reps_range: opts.reps_range ?? null,
  duration_sec: opts.duration_sec ?? null,
  rest_sec: opts.rest_sec ?? null,
  distance_m: opts.distance_m ?? null,
  distance_range: null,
  type: opts.type || 'strength',
  notes: opts.notes ?? null,
});

export const workoutTemplates: CategorizedWorkoutStructure[] = [
  // =============================================================================
  // TRADITIONAL STRENGTH
  // =============================================================================

  // Push Day - Chest & Triceps
  {
    title: "Push Day - Chest & Triceps",
    source: "template",
    category: "strength",
    duration: "~35 min",
    settings: {
      defaultRestType: 'timed',
      defaultRestSec: 60,
    },
    blocks: [
      {
        label: "Warm-up",
        structure: null,
        exercises: [
          ex("Warm-up", { duration_sec: 180, type: "warmup", notes: "Light cardio and shoulder mobility" }),
        ],
        supersets: [],
        rounds: null,
        sets: null,
      },
      {
        label: "Chest",
        structure: null,
        exercises: [
          ex("Bench Press", { sets: 4, reps: 8, rest_sec: 90, notes: "Main compound lift" }),
          ex("Incline Dumbbell Press", { sets: 3, reps: 10, rest_sec: 60, notes: "Upper chest focus" }),
          ex("Cable Flyes", { sets: 3, reps: 12, rest_sec: 60, notes: "Squeeze at the top" }),
        ],
        supersets: [],
        rounds: null,
        sets: null,
      },
      {
        label: "Triceps",
        structure: null,
        exercises: [
          ex("Tricep Pushdowns", { sets: 3, reps: 12, rest_sec: 45, notes: "Cable machine" }),
          ex("Overhead Tricep Extension", { sets: 3, reps: 12, rest_sec: 45, notes: "Dumbbell or cable" }),
        ],
        supersets: [],
        rounds: null,
        sets: null,
      },
    ],
  },

  // Pull Day - Back & Biceps
  {
    title: "Pull Day - Back & Biceps",
    source: "template",
    category: "strength",
    duration: "~45 min",
    settings: {
      defaultRestType: 'timed',
      defaultRestSec: 90,
    },
    blocks: [
      {
        label: "Warm-up",
        structure: null,
        exercises: [
          ex("Warm-up", { duration_sec: 180, type: "warmup", notes: "Light rowing and lat stretches" }),
        ],
        supersets: [],
        rounds: null,
        sets: null,
      },
      {
        label: "Back",
        structure: null,
        exercises: [
          ex("Deadlift", { sets: 4, reps: 6, rest_sec: 120, notes: "Heavy compound - focus on form" }),
          ex("Barbell Rows", { sets: 4, reps: 8, rest_sec: 90, notes: "Underhand or overhand grip" }),
          ex("Lat Pulldowns", { sets: 3, reps: 10, rest_sec: 60, notes: "Wide grip" }),
          ex("Face Pulls", { sets: 3, reps: 15, rest_sec: 45, notes: "Rear delts and upper back" }),
        ],
        supersets: [],
        rounds: null,
        sets: null,
      },
      {
        label: "Biceps",
        structure: null,
        exercises: [
          ex("Barbell Curls", { sets: 3, reps: 10, rest_sec: 45, notes: "Strict form" }),
          ex("Hammer Curls", { sets: 3, reps: 12, rest_sec: 45, notes: "Brachialis focus" }),
        ],
        supersets: [],
        rounds: null,
        sets: null,
      },
    ],
  },

  // Leg Day - Quads & Hamstrings
  {
    title: "Leg Day - Quads & Hamstrings",
    source: "template",
    category: "strength",
    duration: "~50 min",
    settings: {
      defaultRestType: 'timed',
      defaultRestSec: 90,
    },
    blocks: [
      {
        label: "Warm-up",
        structure: null,
        exercises: [
          ex("Warm-up", { duration_sec: 300, type: "warmup", notes: "5 min bike or walking + leg swings" }),
        ],
        supersets: [],
        rounds: null,
        sets: null,
      },
      {
        label: "Quads",
        structure: null,
        exercises: [
          ex("Barbell Squats", { sets: 5, reps: 5, rest_sec: 180, notes: "5x5 format - heavy weight" }),
          ex("Leg Press", { sets: 3, reps: 12, rest_sec: 60, notes: "Full range of motion" }),
          ex("Walking Lunges", { sets: 3, reps: 10, rest_sec: 60, notes: "10 each leg" }),
        ],
        supersets: [],
        rounds: null,
        sets: null,
      },
      {
        label: "Hamstrings & Calves",
        structure: null,
        exercises: [
          ex("Romanian Deadlifts", { sets: 4, reps: 8, rest_sec: 90, notes: "Feel the stretch" }),
          ex("Leg Curls", { sets: 3, reps: 12, rest_sec: 45, notes: "Machine - controlled tempo" }),
          ex("Calf Raises", { sets: 4, reps: 15, rest_sec: 30, notes: "Full stretch at bottom" }),
        ],
        supersets: [],
        rounds: null,
        sets: null,
      },
    ],
  },

  // =============================================================================
  // HIIT / INTERVAL
  // =============================================================================

  // Tabata Blast
  {
    title: "Tabata Blast",
    source: "template",
    category: "hiit",
    duration: "~20 min",
    settings: {
      defaultRestType: 'timed',
      defaultRestSec: 10,
    },
    blocks: [
      {
        label: "Tabata 1 - Jump Squats",
        structure: 'tabata',
        exercises: [
          ex("Jump Squats", { duration_sec: 20, type: "HIIT", notes: "Explosive! 8 rounds: 20s work / 10s rest" }),
        ],
        supersets: [],
        rounds: 8,
        sets: null,
        time_work_sec: 20,
        time_rest_sec: 10,
      },
      {
        label: "Rest",
        structure: null,
        exercises: [
          ex("Rest", { duration_sec: 60, type: "rest", notes: "Catch your breath" }),
        ],
        supersets: [],
        rounds: null,
        sets: null,
      },
      {
        label: "Tabata 2 - Mountain Climbers",
        structure: 'tabata',
        exercises: [
          ex("Mountain Climbers", { duration_sec: 20, type: "HIIT", notes: "Fast pace - 8 rounds" }),
        ],
        supersets: [],
        rounds: 8,
        sets: null,
        time_work_sec: 20,
        time_rest_sec: 10,
      },
      {
        label: "Rest",
        structure: null,
        exercises: [
          ex("Rest", { duration_sec: 60, type: "rest", notes: "Shake it out" }),
        ],
        supersets: [],
        rounds: null,
        sets: null,
      },
      {
        label: "Tabata 3 - Burpees",
        structure: 'tabata',
        exercises: [
          ex("Burpees", { duration_sec: 20, type: "HIIT", notes: "Full burpees with jump - 8 rounds" }),
        ],
        supersets: [],
        rounds: 8,
        sets: null,
        time_work_sec: 20,
        time_rest_sec: 10,
      },
      {
        label: "Rest",
        structure: null,
        exercises: [
          ex("Rest", { duration_sec: 60, type: "rest", notes: "Almost there!" }),
        ],
        supersets: [],
        rounds: null,
        sets: null,
      },
      {
        label: "Tabata 4 - High Knees",
        structure: 'tabata',
        exercises: [
          ex("High Knees", { duration_sec: 20, type: "HIIT", notes: "Pump those arms! 8 rounds" }),
        ],
        supersets: [],
        rounds: 8,
        sets: null,
        time_work_sec: 20,
        time_rest_sec: 10,
      },
    ],
  },

  // 30/30 HIIT Circuit
  {
    title: "30/30 HIIT Circuit",
    source: "template",
    category: "hiit",
    duration: "~22 min",
    settings: {
      defaultRestType: 'timed',
      defaultRestSec: 30,
    },
    blocks: [
      {
        label: "Warm-up",
        structure: null,
        exercises: [
          ex("Warm-up", { duration_sec: 120, type: "warmup", notes: "Light jog in place" }),
        ],
        supersets: [],
        rounds: null,
        sets: null,
      },
      {
        label: "HIIT Circuit - 3 Rounds",
        structure: 'circuit',
        exercises: [
          ex("Jumping Jacks", { duration_sec: 30, rest_sec: 30, type: "HIIT", notes: "30s work" }),
          ex("Push-ups", { duration_sec: 30, rest_sec: 30, type: "HIIT", notes: "30s work" }),
          ex("Squat Jumps", { duration_sec: 30, rest_sec: 30, type: "HIIT", notes: "30s work" }),
          ex("Plank", { duration_sec: 30, rest_sec: 30, type: "HIIT", notes: "30s hold" }),
          ex("Burpees", { duration_sec: 30, rest_sec: 30, type: "HIIT", notes: "30s work" }),
          ex("Lunges", { duration_sec: 30, rest_sec: 30, type: "HIIT", notes: "30s alternating" }),
        ],
        supersets: [],
        rounds: 3,
        sets: null,
        time_work_sec: 30,
        time_rest_sec: 30,
        rest_between_rounds_sec: 30,
      },
      {
        label: "Cool Down",
        structure: null,
        exercises: [
          ex("Cool Down Stretches", { duration_sec: 120, type: "cooldown", notes: "Light stretching" }),
        ],
        supersets: [],
        rounds: null,
        sets: null,
      },
    ],
  },

  // =============================================================================
  // QUICK WORKOUTS
  // =============================================================================

  // 10-Minute Ab Blast
  {
    title: "10-Minute Ab Blast",
    source: "template",
    category: "quick",
    duration: "10 min",
    settings: {
      defaultRestType: 'timed',
      defaultRestSec: 15,
    },
    blocks: [
      {
        label: "Ab Circuit - 2 Rounds",
        structure: 'circuit',
        exercises: [
          ex("Crunches", { duration_sec: 45, rest_sec: 15, type: "core", notes: "Controlled movement" }),
          ex("Leg Raises", { duration_sec: 45, rest_sec: 15, type: "core", notes: "Lower abs focus" }),
          ex("Russian Twists", { duration_sec: 45, rest_sec: 15, type: "core", notes: "Touch floor each side" }),
          ex("Plank", { duration_sec: 45, rest_sec: 15, type: "core", notes: "Hold steady" }),
          ex("Mountain Climbers", { duration_sec: 45, rest_sec: 15, type: "core", notes: "Fast pace" }),
        ],
        supersets: [],
        rounds: 2,
        sets: null,
        time_work_sec: 45,
        time_rest_sec: 15,
        rest_between_rounds_sec: 15,
      },
    ],
  },

  // 15-Minute Upper Body Burn
  {
    title: "15-Minute Upper Body Burn",
    source: "template",
    category: "quick",
    duration: "15 min",
    settings: {
      defaultRestType: 'timed',
      defaultRestSec: 20,
    },
    blocks: [
      {
        label: "Upper Body Circuit - 3 Rounds",
        structure: 'circuit',
        exercises: [
          ex("Push-ups", { duration_sec: 40, rest_sec: 20, type: "strength", notes: "Bodyweight" }),
          ex("Diamond Push-ups", { duration_sec: 40, rest_sec: 20, type: "strength", notes: "Tricep focus" }),
          ex("Pike Push-ups", { duration_sec: 40, rest_sec: 20, type: "strength", notes: "Shoulder focus" }),
          ex("Plank to Push-up", { duration_sec: 40, rest_sec: 20, type: "strength", notes: "Alternate arms" }),
          ex("Arm Circles", { duration_sec: 40, rest_sec: 20, type: "strength", notes: "Forward then back" }),
        ],
        supersets: [],
        rounds: 3,
        sets: null,
        time_work_sec: 40,
        time_rest_sec: 20,
        rest_between_rounds_sec: 20,
      },
    ],
  },

  // 12-Minute Dumbbell Arms
  {
    title: "12-Minute Dumbbell Arms",
    source: "template",
    category: "quick",
    duration: "12 min",
    settings: {
      defaultRestType: 'timed',
      defaultRestSec: 30,
    },
    blocks: [
      {
        label: "Arm Circuit - 3 Rounds",
        structure: 'circuit',
        exercises: [
          ex("Bicep Curls", { reps: 12, rest_sec: 30, type: "strength", notes: "Controlled tempo" }),
          ex("Tricep Kickbacks", { reps: 12, rest_sec: 30, type: "strength", notes: "Squeeze at top" }),
          ex("Hammer Curls", { reps: 10, rest_sec: 30, type: "strength", notes: "Neutral grip" }),
          ex("Overhead Extensions", { reps: 10, rest_sec: 30, type: "strength", notes: "Both hands on dumbbell" }),
          ex("21s Curls", { reps: 21, rest_sec: 30, type: "strength", notes: "7 bottom, 7 top, 7 full" }),
        ],
        supersets: [],
        rounds: 3,
        sets: null,
        rest_between_rounds_sec: 30,
      },
    ],
  },

  // =============================================================================
  // EMOM / AMRAP
  // =============================================================================

  // 20-Minute EMOM
  {
    title: "20-Minute EMOM",
    source: "template",
    category: "emom-amrap",
    duration: "20 min",
    settings: {
      defaultRestType: 'timed',
      defaultRestSec: null,
    },
    blocks: [
      {
        label: "EMOM - 5 Rounds of 4 Minutes",
        structure: 'emom',
        exercises: [
          ex("Kettlebell Swings", { reps: 15, type: "strength", notes: "Minute 1" }),
          ex("Goblet Squats", { reps: 10, type: "strength", notes: "Minute 2" }),
          ex("Push-ups", { reps: 8, type: "strength", notes: "Minute 3" }),
          ex("Lunges (alternating)", { reps: 12, type: "strength", notes: "Minute 4 - 6 each leg" }),
        ],
        supersets: [],
        rounds: 5,
        sets: null,
        time_work_sec: 60,  // 1 minute per exercise
      },
    ],
  },

  // 12-Minute AMRAP
  {
    title: "12-Minute AMRAP",
    source: "template",
    category: "emom-amrap",
    duration: "12 min",
    settings: {
      defaultRestType: 'button',
      defaultRestSec: null,
    },
    blocks: [
      {
        label: "AMRAP - As Many Rounds As Possible",
        structure: 'amrap',
        exercises: [
          ex("Air Squats", { reps: 15, type: "strength", notes: "Full depth" }),
          ex("Push-ups", { reps: 10, type: "strength", notes: "Chest to floor" }),
          ex("Sit-ups", { reps: 10, type: "core", notes: "Touch toes" }),
        ],
        supersets: [],
        rounds: null,
        sets: null,
        time_cap_sec: 720,  // 12 minute cap
      },
    ],
  },

  // =============================================================================
  // SINGLE BODY PART FOCUS
  // =============================================================================

  // Shoulder Sculptor
  {
    title: "Shoulder Sculptor",
    source: "template",
    category: "focus",
    duration: "~30 min",
    settings: {
      defaultRestType: 'timed',
      defaultRestSec: 45,
    },
    blocks: [
      {
        label: "Warm-up",
        structure: null,
        exercises: [
          ex("Arm Circles", { duration_sec: 120, type: "warmup", notes: "Forward and backward" }),
        ],
        supersets: [],
        rounds: null,
        sets: null,
      },
      {
        label: "Compound",
        structure: null,
        exercises: [
          ex("Overhead Press", { sets: 4, reps: 8, rest_sec: 60, notes: "Main lift - go heavy" }),
          ex("Arnold Press", { sets: 3, reps: 10, rest_sec: 45, notes: "Rotation at top" }),
        ],
        supersets: [],
        rounds: null,
        sets: null,
      },
      {
        label: "Isolation",
        structure: null,
        exercises: [
          ex("Lateral Raises", { sets: 3, reps: 12, rest_sec: 30, notes: "Control the negative" }),
          ex("Front Raises", { sets: 3, reps: 12, rest_sec: 30, notes: "Alternate arms" }),
          ex("Rear Delt Flyes", { sets: 3, reps: 15, rest_sec: 30, notes: "Bent over position" }),
          ex("Shrugs", { sets: 3, reps: 12, rest_sec: 30, notes: "Hold at top" }),
        ],
        supersets: [],
        rounds: null,
        sets: null,
      },
    ],
  },

  // Glute Builder
  {
    title: "Glute Builder",
    source: "template",
    category: "focus",
    duration: "~25 min",
    settings: {
      defaultRestType: 'timed',
      defaultRestSec: 45,
    },
    blocks: [
      {
        label: "Activation",
        structure: null,
        exercises: [
          ex("Glute Bridges", { sets: 2, reps: 15, rest_sec: 30, notes: "Squeeze at top" }),
          ex("Clamshells", { sets: 2, reps: 12, rest_sec: 30, notes: "Each side" }),
        ],
        supersets: [],
        rounds: null,
        sets: null,
      },
      {
        label: "Main Work",
        structure: null,
        exercises: [
          ex("Hip Thrusts", { sets: 4, reps: 10, rest_sec: 60, notes: "Barbell or dumbbell" }),
          ex("Bulgarian Split Squats", { sets: 3, reps: 10, rest_sec: 45, notes: "Each leg" }),
          ex("Romanian Deadlifts", { sets: 3, reps: 12, rest_sec: 45, notes: "Glute focus" }),
        ],
        supersets: [],
        rounds: null,
        sets: null,
      },
      {
        label: "Finisher",
        structure: null,
        exercises: [
          ex("Donkey Kicks", { sets: 2, reps: 20, rest_sec: 30, notes: "Each leg - high reps" }),
          ex("Fire Hydrants", { sets: 2, reps: 20, rest_sec: 30, notes: "Each leg - burn it out" }),
        ],
        supersets: [],
        rounds: null,
        sets: null,
      },
    ],
  },

  // =============================================================================
  // EXISTING TEMPLATES (kept for backwards compatibility)
  // =============================================================================

  // Full Body Superset Training (original)
  {
    title: "Full Body Superset Training",
    source: "template",
    category: "superset",
    duration: "~30 min",
    settings: {
      defaultRestType: 'timed',
      defaultRestSec: 60,
    },
    blocks: [
      {
        label: "Upper Body Supersets",
        structure: null,
        exercises: [],
        supersets: [
          {
            id: "ss-upper-1",
            exercises: [
              ex("Bench Press", { sets: 4, reps: 10, notes: "Chest focus" }),
              ex("Bent Over Row", { sets: 4, reps: 10, notes: "Back focus" }),
              ex("Face Pulls", { sets: 4, reps: 15, notes: "Rear delts" }),
            ],
            rest_between_sec: 90,
            rest_type: 'timed',
          },
          {
            id: "ss-upper-2",
            exercises: [
              ex("Overhead Press", { sets: 3, reps: 12, notes: "Shoulders" }),
              ex("Lat Pulldown", { sets: 3, reps: 12, notes: "Lats" }),
            ],
            rest_between_sec: 60,
            rest_type: 'timed',
          },
        ],
        rounds: null,
        sets: null,
      },
      {
        label: "Lower Body Supersets",
        structure: null,
        exercises: [],
        supersets: [
          {
            id: "ss-lower-1",
            exercises: [
              ex("Barbell Back Squat", { sets: 5, reps: 5, notes: "Heavy compound" }),
              ex("Romanian Deadlift", { sets: 5, reps: 8, notes: "Hamstrings" }),
            ],
            rest_between_sec: 120,
            rest_type: 'timed',
          },
          {
            id: "ss-lower-2",
            exercises: [
              ex("Walking Lunges", { sets: 3, reps: 20, notes: "10 per leg" }),
              ex("Calf Raises", { sets: 3, reps: 15, notes: "Slow tempo" }),
              ex("Leg Curls", { sets: 3, reps: 12, notes: "Machine" }),
            ],
            rest_type: 'button',
          },
        ],
        rounds: null,
        sets: null,
      },
    ],
  },

  // Hyrox Full Simulation (original)
  {
    title: "Hyrox Full Simulation",
    source: "template",
    category: "cardio",
    duration: "~60 min",
    blocks: [
      {
        label: "Hyrox Race Simulation",
        structure: null,
        exercises: [
          ex("Run", { distance_m: 1000, type: "cardio", notes: "The race starts with a 1km run on the track" }),
          ex("Ski Erg", { distance_m: 1000, type: "cardio", notes: "1,000 meters on a ski ergometer" }),
          ex("Run", { distance_m: 1000, type: "cardio", notes: "Another 1km run" }),
          ex("Sled Push", { distance_m: 50, type: "strength", notes: "A 50-meter sled push" }),
          ex("Run", { distance_m: 1000, type: "cardio", notes: "Another 1km run" }),
          ex("Sled Pull", { distance_m: 50, type: "strength", notes: "A 50-meter sled pull" }),
          ex("Run", { distance_m: 1000, type: "cardio", notes: "Another 1km run" }),
          ex("Burpee Broad Jumps", { distance_m: 80, type: "hyrox", notes: "80 meters of burpee broad jumps" }),
          ex("Run", { distance_m: 1000, type: "cardio", notes: "Another 1km run" }),
          ex("Rowing", { distance_m: 1000, type: "cardio", notes: "1,000 meters on a rowing machine" }),
          ex("Run", { distance_m: 1000, type: "cardio", notes: "Another 1km run" }),
          ex("Farmer's Carry", { distance_m: 200, type: "strength", notes: "200 meters with a farmer's carry" }),
          ex("Run", { distance_m: 1000, type: "cardio", notes: "Another 1km run" }),
          ex("Sandbag Lunges", { distance_m: 100, type: "strength", notes: "100 meters of sandbag lunges" }),
          ex("Run", { distance_m: 1000, type: "cardio", notes: "The final 1km run" }),
          ex("Wall Balls", { reps: 100, type: "strength", notes: "The final exercise is 100 wall balls" }),
        ],
        supersets: [],
        rounds: null,
        sets: null,
      },
    ],
  },
];

export interface WorkoutHistory {
  id: string;
  workout: WorkoutStructure;
  createdAt: Date;
  exported: boolean;
}

// Mock history data
export const getWorkoutHistory = (): WorkoutHistory[] => {
  const now = new Date();
  return [
    {
      id: '1',
      workout: {
        title: "Morning HIIT Session",
        source: "instagram:https://instagram.com/p/...",
        blocks: [
          {
            label: "Quick HIIT",
            structure: 'rounds',
            exercises: [],
            supersets: [
              {
                id: "ss-hiit-1",
                exercises: [
                  ex("Burpees", { reps: 20, type: "HIIT" }),
                  ex("Push-ups", { reps: 15, type: "strength" }),
                ],
              },
            ],
            rounds: 5,
          },
        ],
      },
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      exported: true,
    },
    {
      id: '2',
      workout: {
        title: "Leg Day Strength",
        source: "youtube:https://youtube.com/watch?v=...",
        blocks: [
          {
            label: "Legs",
            structure: 'sets',
            exercises: [],
            supersets: [
              {
                id: "ss-legs-1",
                exercises: [
                  ex("Back Squat", { sets: 4, reps: 8, type: "strength" }),
                  ex("Romanian Deadlift", { sets: 4, reps: 8, type: "strength" }),
                ],
              },
            ],
            sets: 4,
          },
        ],
      },
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      exported: true,
    },
    {
      id: '3',
      workout: {
        title: "Recovery Run",
        source: "ai-text:Easy 5k recovery run",
        blocks: [
          {
            label: "Recovery",
            structure: null,
            exercises: [
              ex("Easy Run", { distance_m: 5000, type: "cardio", notes: "Easy pace" }),
            ],
            supersets: [],
          },
        ],
      },
      createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000),
      exported: false,
    },
  ];
};

// Helper to get templates by category
export const getTemplatesByCategory = (): Map<TemplateCategory, CategorizedWorkoutStructure[]> => {
  const map = new Map<TemplateCategory, CategorizedWorkoutStructure[]>();

  for (const template of workoutTemplates) {
    const category = template.category;
    if (!map.has(category)) {
      map.set(category, []);
    }
    map.get(category)!.push(template);
  }

  return map;
};
