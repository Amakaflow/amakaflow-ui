// Program Generation Wizard Types

export type ProgramGoal = 'strength' | 'hypertrophy' | 'fat_loss' | 'endurance' | 'general_fitness';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export type EquipmentPreset = 'full_gym' | 'home_basic' | 'home_advanced' | 'bodyweight';

export type SessionDuration = 30 | 45 | 60 | 90;

export type FocusArea =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'core'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves';

export type ProgramWizardStep =
  | 'goal'
  | 'experience'
  | 'schedule'
  | 'equipment'
  | 'preferences'
  | 'review';

export const WIZARD_STEPS: ProgramWizardStep[] = [
  'goal',
  'experience',
  'schedule',
  'equipment',
  'preferences',
  'review',
];

export type DayOfWeek = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export interface ProgramWizardState {
  // Navigation
  step: ProgramWizardStep;

  // Step 1: Goal
  goal: ProgramGoal | null;

  // Step 2: Experience
  experienceLevel: ExperienceLevel | null;

  // Step 3: Schedule
  durationWeeks: number;
  sessionsPerWeek: number;
  preferredDays: DayOfWeek[];
  timePerSession: SessionDuration;

  // Step 4: Equipment
  equipmentPreset: EquipmentPreset | null;
  useCustomEquipment: boolean;
  customEquipment: string[];

  // Step 5: Preferences
  injuries: string;
  focusAreas: FocusArea[];
  avoidExercises: string[];

  // Generation
  isGenerating: boolean;
  generationProgress: number;
  generationJobId: string | null;
  generationError: string | null;
  generatedProgramId: string | null;
}

export const initialProgramWizardState: ProgramWizardState = {
  step: 'goal',
  goal: null,
  experienceLevel: null,
  durationWeeks: 8,
  sessionsPerWeek: 3,
  preferredDays: [],
  timePerSession: 60,
  equipmentPreset: null,
  useCustomEquipment: false,
  customEquipment: [],
  injuries: '',
  focusAreas: [],
  avoidExercises: [],
  isGenerating: false,
  generationProgress: 0,
  generationJobId: null,
  generationError: null,
  generatedProgramId: null,
};

// Equipment preset mappings
export const EQUIPMENT_PRESETS: Record<EquipmentPreset, string[]> = {
  full_gym: [
    'barbell',
    'dumbbells',
    'cable_machine',
    'leg_press',
    'lat_pulldown',
    'bench',
    'squat_rack',
    'pull_up_bar',
    'machines',
  ],
  home_advanced: [
    'barbell',
    'dumbbells',
    'bench',
    'squat_rack',
    'pull_up_bar',
    'resistance_bands',
  ],
  home_basic: [
    'dumbbells',
    'resistance_bands',
    'pull_up_bar',
    'bench',
  ],
  bodyweight: [
    'pull_up_bar',
    'resistance_bands',
  ],
};

export const ALL_EQUIPMENT = [
  'barbell',
  'dumbbells',
  'kettlebells',
  'cable_machine',
  'leg_press',
  'lat_pulldown',
  'bench',
  'squat_rack',
  'pull_up_bar',
  'machines',
  'resistance_bands',
  'trx',
  'medicine_ball',
  'foam_roller',
];

// Validation helpers
export function canProceedFromStep(state: ProgramWizardState, step: ProgramWizardStep): boolean {
  switch (step) {
    case 'goal':
      return state.goal !== null;
    case 'experience':
      return state.experienceLevel !== null;
    case 'schedule':
      return (
        state.durationWeeks >= 4 &&
        state.durationWeeks <= 52 &&
        state.sessionsPerWeek >= 1 &&
        state.sessionsPerWeek <= 7 &&
        state.preferredDays.length > 0
      );
    case 'equipment':
      return (
        state.equipmentPreset !== null ||
        (state.useCustomEquipment && state.customEquipment.length > 0)
      );
    case 'preferences':
      return true; // Optional step, always valid
    case 'review':
      return (
        canProceedFromStep(state, 'goal') &&
        canProceedFromStep(state, 'experience') &&
        canProceedFromStep(state, 'schedule') &&
        canProceedFromStep(state, 'equipment')
      );
    default:
      return false;
  }
}

export function getEquipmentForState(state: ProgramWizardState): string[] {
  if (state.useCustomEquipment) {
    return state.customEquipment;
  }
  if (state.equipmentPreset) {
    return EQUIPMENT_PRESETS[state.equipmentPreset];
  }
  return [];
}

// API Types
export interface ProgramGenerationRequest {
  user_id: string;
  goal: ProgramGoal;
  experience_level: ExperienceLevel;
  duration_weeks: number;
  sessions_per_week: number;
  preferred_days: DayOfWeek[];
  time_per_session: SessionDuration;
  equipment: string[];
  injuries?: string;
  focus_areas?: FocusArea[];
  avoid_exercises?: string[];
}

export interface ProgramGenerationResponse {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  program_id?: string;
  error?: string;
}

export interface ProgramGenerationStatusResponse {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  program_id?: string;
  error?: string;
}

// Display labels
export const GOAL_LABELS: Record<ProgramGoal, { label: string; description: string }> = {
  strength: {
    label: 'Build Strength',
    description: 'Focus on increasing max lifts and overall power',
  },
  hypertrophy: {
    label: 'Build Muscle',
    description: 'Optimize for muscle growth and size',
  },
  fat_loss: {
    label: 'Lose Fat',
    description: 'High-intensity workouts for fat burning',
  },
  endurance: {
    label: 'Build Endurance',
    description: 'Improve stamina and cardiovascular fitness',
  },
  general_fitness: {
    label: 'General Fitness',
    description: 'Balanced approach to overall health',
  },
};

export const EXPERIENCE_LABELS: Record<ExperienceLevel, { label: string; description: string }> = {
  beginner: {
    label: 'Beginner',
    description: 'New to training or less than 1 year experience',
  },
  intermediate: {
    label: 'Intermediate',
    description: '1-3 years of consistent training',
  },
  advanced: {
    label: 'Advanced',
    description: '3+ years of serious training',
  },
};

export const EQUIPMENT_LABELS: Record<EquipmentPreset, { label: string; description: string }> = {
  full_gym: {
    label: 'Full Gym',
    description: 'Access to a complete commercial gym',
  },
  home_advanced: {
    label: 'Home Gym (Advanced)',
    description: 'Barbell, rack, bench, and dumbbells',
  },
  home_basic: {
    label: 'Home Gym (Basic)',
    description: 'Dumbbells, bands, and pull-up bar',
  },
  bodyweight: {
    label: 'Bodyweight Only',
    description: 'Minimal equipment, mainly bodyweight exercises',
  },
};

export const FOCUS_AREA_LABELS: Record<FocusArea, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  core: 'Core',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
};

export const DAY_LABELS: Record<DayOfWeek, { short: string; full: string }> = {
  sunday: { short: 'Sun', full: 'Sunday' },
  monday: { short: 'Mon', full: 'Monday' },
  tuesday: { short: 'Tue', full: 'Tuesday' },
  wednesday: { short: 'Wed', full: 'Wednesday' },
  thursday: { short: 'Thu', full: 'Thursday' },
  friday: { short: 'Fri', full: 'Friday' },
  saturday: { short: 'Sat', full: 'Saturday' },
};

export const EQUIPMENT_LABELS_MAP: Record<string, string> = {
  barbell: 'Barbell',
  dumbbells: 'Dumbbells',
  kettlebells: 'Kettlebells',
  cable_machine: 'Cable Machine',
  leg_press: 'Leg Press',
  lat_pulldown: 'Lat Pulldown',
  bench: 'Bench',
  squat_rack: 'Squat Rack',
  pull_up_bar: 'Pull-up Bar',
  machines: 'Machines',
  resistance_bands: 'Resistance Bands',
  trx: 'TRX/Suspension Trainer',
  medicine_ball: 'Medicine Ball',
  foam_roller: 'Foam Roller',
};
