import { WorkoutStructure } from '../types/workout';

export const workoutTemplates: WorkoutStructure[] = [
  {
    title: "Hyrox Full Simulation",
    source: "template",
    blocks: [
      {
        label: "Hyrox Race Simulation",
        structure: null,
        exercises: [
          { name: "Run", distance_m: 1000, type: "cardio", sets: null, reps: null, reps_range: null, duration_sec: null, rest_sec: null, distance_range: null, notes: "The race starts with a 1km run on the track" },
          { name: "Ski Erg", distance_m: 1000, type: "cardio", sets: null, reps: null, reps_range: null, duration_sec: null, rest_sec: null, distance_range: null, notes: "1,000 meters on a ski ergometer" },
          { name: "Run", distance_m: 1000, type: "cardio", sets: null, reps: null, reps_range: null, duration_sec: null, rest_sec: null, distance_range: null, notes: "Another 1km run" },
          { name: "Sled Push", distance_m: 50, type: "strength", sets: null, reps: null, reps_range: null, duration_sec: null, rest_sec: null, distance_range: null, notes: "A 50-meter sled push" },
          { name: "Run", distance_m: 1000, type: "cardio", sets: null, reps: null, reps_range: null, duration_sec: null, rest_sec: null, distance_range: null, notes: "Another 1km run" },
          { name: "Sled Pull", distance_m: 50, type: "strength", sets: null, reps: null, reps_range: null, duration_sec: null, rest_sec: null, distance_range: null, notes: "A 50-meter sled pull" },
          { name: "Run", distance_m: 1000, type: "cardio", sets: null, reps: null, reps_range: null, duration_sec: null, rest_sec: null, distance_range: null, notes: "Another 1km run" },
          { name: "Burpee Broad Jumps", distance_m: 80, type: "hirox", sets: null, reps: null, reps_range: null, duration_sec: null, rest_sec: null, distance_range: null, notes: "80 meters of burpee broad jumps" },
          { name: "Run", distance_m: 1000, type: "cardio", sets: null, reps: null, reps_range: null, duration_sec: null, rest_sec: null, distance_range: null, notes: "Another 1km run" },
          { name: "Rowing", distance_m: 1000, type: "cardio", sets: null, reps: null, reps_range: null, duration_sec: null, rest_sec: null, distance_range: null, notes: "1,000 meters on a rowing machine" },
          { name: "Run", distance_m: 1000, type: "cardio", sets: null, reps: null, reps_range: null, duration_sec: null, rest_sec: null, distance_range: null, notes: "Another 1km run" },
          { name: "Farmer's Carry", distance_m: 200, type: "strength", sets: null, reps: null, reps_range: null, duration_sec: null, rest_sec: null, distance_range: null, notes: "200 meters with a farmer's carry" },
          { name: "Run", distance_m: 1000, type: "cardio", sets: null, reps: null, reps_range: null, duration_sec: null, rest_sec: null, distance_range: null, notes: "Another 1km run" },
          { name: "Sandbag Lunges", distance_m: 100, type: "strength", sets: null, reps: null, reps_range: null, duration_sec: null, rest_sec: null, distance_range: null, notes: "100 meters of sandbag lunges" },
          { name: "Run", distance_m: 1000, type: "cardio", sets: null, reps: null, reps_range: null, duration_sec: null, rest_sec: null, distance_range: null, notes: "The final 1km run" },
          { name: "Wall Balls", reps: 100, type: "strength", sets: null, reps_range: null, duration_sec: null, rest_sec: null, distance_m: null, distance_range: null, notes: "The final exercise is 100 wall balls" }
        ],
        supersets: [],
        rounds: null,
        sets: null,
        time_cap_sec: null,
        time_work_sec: null,
        time_rest_sec: null,
        rest_between_rounds_sec: null,
        rest_between_sets_sec: null
      }
    ]
  },
  {
    title: "5x5 Strength Program",
    source: "template",
    blocks: [
      {
        label: "Compound Lifts",
        structure: "5 sets x 5 reps",
        supersets: [
          {
            exercises: [
              { name: "Barbell Back Squat", reps: 5, type: "Strength" },
              { name: "Barbell Bench Press", reps: 5, type: "Strength" },
              { name: "Barbell Deadlift", reps: 5, type: "Strength" }
            ]
          }
        ]
      }
    ]
  },
  {
    title: "HIIT Cardio Blast",
    source: "template",
    blocks: [
      {
        label: "Warm-up",
        structure: "for time",
        supersets: [
          {
            exercises: [
              { name: "Jogging", duration_sec: 300, type: "Cardio" },
              { name: "Dynamic Stretching", duration_sec: 180, type: "Mobility" }
            ]
          }
        ]
      },
      {
        label: "HIIT Intervals",
        structure: "8 rounds: 30s work / 15s rest",
        supersets: [
          {
            exercises: [
              { name: "Burpees", duration_sec: 30, type: "HIIT" },
              { name: "Mountain Climbers", duration_sec: 30, type: "HIIT" },
              { name: "Jump Squats", duration_sec: 30, type: "HIIT" },
              { name: "High Knees", duration_sec: 30, type: "HIIT" }
            ]
          }
        ]
      },
      {
        label: "Cool Down",
        structure: "for time",
        supersets: [
          {
            exercises: [
              { name: "Walking", duration_sec: 300, type: "Cardio" },
              { name: "Static Stretching", duration_sec: 300, type: "Mobility" }
            ]
          }
        ]
      }
    ]
  },
  {
    title: "Upper Body Push/Pull",
    source: "template",
    blocks: [
      {
        label: "Push Exercises",
        structure: "3 sets x 10-12 reps",
        supersets: [
          {
            exercises: [
              { name: "Push-ups", reps: 12, type: "Strength" },
              { name: "Overhead Press", reps: 10, type: "Strength" },
              { name: "Dips", reps: 10, type: "Strength" }
            ]
          }
        ]
      },
      {
        label: "Pull Exercises",
        structure: "3 sets x 10-12 reps",
        supersets: [
          {
            exercises: [
              { name: "Pull-ups", reps: 10, type: "Strength" },
              { name: "Bent Over Row", reps: 12, type: "Strength" },
              { name: "Face Pulls", reps: 15, type: "Strength" }
            ]
          }
        ]
      }
    ]
  },
  {
    title: "Marathon Prep Long Run",
    source: "template",
    blocks: [
      {
        label: "Long Distance Run",
        structure: "steady pace",
        supersets: [
          {
            exercises: [
              { name: "Easy Run", distance_m: 20000, type: "Cardio" }
            ]
          }
        ]
      }
    ]
  }
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
            structure: "5 rounds",
            supersets: [
              {
                exercises: [
                  { name: "Burpees", reps: 20, type: "HIIT" },
                  { name: "Push-ups", reps: 15, type: "Strength" }
                ]
              }
            ]
          }
        ]
      },
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
      exported: true
    },
    {
      id: '2',
      workout: {
        title: "Leg Day Strength",
        source: "youtube:https://youtube.com/watch?v=...",
        blocks: [
          {
            label: "Legs",
            structure: "4 sets x 8 reps",
            supersets: [
              {
                exercises: [
                  { name: "Back Squat", reps: 8, type: "Strength" },
                  { name: "Romanian Deadlift", reps: 8, type: "Strength" }
                ]
              }
            ]
          }
        ]
      },
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1 day ago
      exported: true
    },
    {
      id: '3',
      workout: {
        title: "Recovery Run",
        source: "ai-text:Easy 5k recovery run",
        blocks: [
          {
            label: "Recovery",
            structure: "easy pace",
            supersets: [
              {
                exercises: [
                  { name: "Easy Run", distance_m: 5000, type: "Cardio" }
                ]
              }
            ]
          }
        ]
      },
      createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000), // 2 days ago
      exported: false
    }
  ];
};
