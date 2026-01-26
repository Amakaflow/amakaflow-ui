'use client';

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import {
  ProgramWizardState,
  ProgramWizardStep,
  ProgramGoal,
  ExperienceLevel,
  EquipmentPreset,
  SessionDuration,
  DayOfWeek,
  FocusArea,
  WIZARD_STEPS,
  initialProgramWizardState,
  canProceedFromStep,
} from '@/types/program-wizard';

// Action types
type ProgramWizardAction =
  | { type: 'SET_STEP'; step: ProgramWizardStep }
  | { type: 'GO_NEXT' }
  | { type: 'GO_BACK' }
  | { type: 'SET_GOAL'; goal: ProgramGoal }
  | { type: 'SET_EXPERIENCE_LEVEL'; level: ExperienceLevel }
  | { type: 'SET_DURATION_WEEKS'; weeks: number }
  | { type: 'SET_SESSIONS_PER_WEEK'; sessions: number }
  | { type: 'TOGGLE_PREFERRED_DAY'; day: DayOfWeek }
  | { type: 'SET_TIME_PER_SESSION'; duration: SessionDuration }
  | { type: 'SET_EQUIPMENT_PRESET'; preset: EquipmentPreset }
  | { type: 'SET_USE_CUSTOM_EQUIPMENT'; useCustom: boolean }
  | { type: 'TOGGLE_EQUIPMENT_ITEM'; item: string }
  | { type: 'SET_INJURIES'; injuries: string }
  | { type: 'TOGGLE_FOCUS_AREA'; area: FocusArea }
  | { type: 'ADD_AVOID_EXERCISE'; exercise: string }
  | { type: 'REMOVE_AVOID_EXERCISE'; exercise: string }
  | { type: 'START_GENERATION'; jobId: string }
  | { type: 'UPDATE_GENERATION_PROGRESS'; progress: number }
  | { type: 'GENERATION_COMPLETE'; programId: string }
  | { type: 'GENERATION_FAILED'; error: string }
  | { type: 'CLEAR_GENERATION_ERROR' }
  | { type: 'RESET' };

// Context value type
interface ProgramWizardContextValue {
  state: ProgramWizardState;
  dispatch: React.Dispatch<ProgramWizardAction>;

  // Navigation helpers
  goNext: () => void;
  goBack: () => void;
  goToStep: (step: ProgramWizardStep) => void;
  canGoNext: () => boolean;
  canGoBack: () => boolean;

  // Convenience setters
  setGoal: (goal: ProgramGoal) => void;
  setExperienceLevel: (level: ExperienceLevel) => void;
  setDurationWeeks: (weeks: number) => void;
  setSessionsPerWeek: (sessions: number) => void;
  togglePreferredDay: (day: DayOfWeek) => void;
  setTimePerSession: (duration: SessionDuration) => void;
  setEquipmentPreset: (preset: EquipmentPreset) => void;
  setUseCustomEquipment: (useCustom: boolean) => void;
  toggleEquipmentItem: (item: string) => void;
  setInjuries: (injuries: string) => void;
  toggleFocusArea: (area: FocusArea) => void;
  addAvoidExercise: (exercise: string) => void;
  removeAvoidExercise: (exercise: string) => void;
  startGeneration: (jobId: string) => void;
  updateGenerationProgress: (progress: number) => void;
  generationComplete: (programId: string) => void;
  generationFailed: (error: string) => void;
  clearGenerationError: () => void;
  reset: () => void;
}

// Create context
const ProgramWizardContext = createContext<ProgramWizardContextValue | null>(null);

// Reducer function
function programWizardReducer(
  state: ProgramWizardState,
  action: ProgramWizardAction
): ProgramWizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step };

    case 'GO_NEXT': {
      const currentIndex = WIZARD_STEPS.indexOf(state.step);
      if (currentIndex < WIZARD_STEPS.length - 1 && canProceedFromStep(state, state.step)) {
        return { ...state, step: WIZARD_STEPS[currentIndex + 1] };
      }
      return state;
    }

    case 'GO_BACK': {
      const currentIndex = WIZARD_STEPS.indexOf(state.step);
      if (currentIndex > 0) {
        return { ...state, step: WIZARD_STEPS[currentIndex - 1] };
      }
      return state;
    }

    case 'SET_GOAL':
      return { ...state, goal: action.goal };

    case 'SET_EXPERIENCE_LEVEL':
      return { ...state, experienceLevel: action.level };

    case 'SET_DURATION_WEEKS':
      return { ...state, durationWeeks: action.weeks };

    case 'SET_SESSIONS_PER_WEEK':
      return { ...state, sessionsPerWeek: action.sessions };

    case 'TOGGLE_PREFERRED_DAY': {
      const days = state.preferredDays.includes(action.day)
        ? state.preferredDays.filter((d) => d !== action.day)
        : [...state.preferredDays, action.day];
      return { ...state, preferredDays: days };
    }

    case 'SET_TIME_PER_SESSION':
      return { ...state, timePerSession: action.duration };

    case 'SET_EQUIPMENT_PRESET':
      return { ...state, equipmentPreset: action.preset, useCustomEquipment: false };

    case 'SET_USE_CUSTOM_EQUIPMENT':
      return {
        ...state,
        useCustomEquipment: action.useCustom,
        equipmentPreset: action.useCustom ? null : state.equipmentPreset,
      };

    case 'TOGGLE_EQUIPMENT_ITEM': {
      const items = state.customEquipment.includes(action.item)
        ? state.customEquipment.filter((i) => i !== action.item)
        : [...state.customEquipment, action.item];
      return { ...state, customEquipment: items };
    }

    case 'SET_INJURIES':
      return { ...state, injuries: action.injuries };

    case 'TOGGLE_FOCUS_AREA': {
      const areas = state.focusAreas.includes(action.area)
        ? state.focusAreas.filter((a) => a !== action.area)
        : [...state.focusAreas, action.area];
      return { ...state, focusAreas: areas };
    }

    case 'ADD_AVOID_EXERCISE': {
      if (action.exercise.trim() && !state.avoidExercises.includes(action.exercise.trim())) {
        return { ...state, avoidExercises: [...state.avoidExercises, action.exercise.trim()] };
      }
      return state;
    }

    case 'REMOVE_AVOID_EXERCISE':
      return {
        ...state,
        avoidExercises: state.avoidExercises.filter((e) => e !== action.exercise),
      };

    case 'START_GENERATION':
      return {
        ...state,
        isGenerating: true,
        generationProgress: 0,
        generationJobId: action.jobId,
        generationError: null,
        generatedProgramId: null,
      };

    case 'UPDATE_GENERATION_PROGRESS':
      return { ...state, generationProgress: action.progress };

    case 'GENERATION_COMPLETE':
      return {
        ...state,
        isGenerating: false,
        generationProgress: 100,
        generatedProgramId: action.programId,
        generationError: null,
      };

    case 'GENERATION_FAILED':
      return {
        ...state,
        isGenerating: false,
        generationError: action.error,
      };

    case 'CLEAR_GENERATION_ERROR':
      return { ...state, generationError: null };

    case 'RESET':
      return initialProgramWizardState;

    default:
      return state;
  }
}

// Provider component
interface ProgramWizardProviderProps {
  children: React.ReactNode;
}

export function ProgramWizardProvider({ children }: ProgramWizardProviderProps) {
  const [state, dispatch] = useReducer(programWizardReducer, initialProgramWizardState);

  // Navigation helpers
  const goNext = useCallback(() => dispatch({ type: 'GO_NEXT' }), []);
  const goBack = useCallback(() => dispatch({ type: 'GO_BACK' }), []);
  const goToStep = useCallback(
    (step: ProgramWizardStep) => dispatch({ type: 'SET_STEP', step }),
    []
  );

  const canGoNext = useCallback(() => canProceedFromStep(state, state.step), [state]);
  const canGoBack = useCallback(() => WIZARD_STEPS.indexOf(state.step) > 0, [state.step]);

  // Convenience setters
  const setGoal = useCallback((goal: ProgramGoal) => dispatch({ type: 'SET_GOAL', goal }), []);
  const setExperienceLevel = useCallback(
    (level: ExperienceLevel) => dispatch({ type: 'SET_EXPERIENCE_LEVEL', level }),
    []
  );
  const setDurationWeeks = useCallback(
    (weeks: number) => dispatch({ type: 'SET_DURATION_WEEKS', weeks }),
    []
  );
  const setSessionsPerWeek = useCallback(
    (sessions: number) => dispatch({ type: 'SET_SESSIONS_PER_WEEK', sessions }),
    []
  );
  const togglePreferredDay = useCallback(
    (day: DayOfWeek) => dispatch({ type: 'TOGGLE_PREFERRED_DAY', day }),
    []
  );
  const setTimePerSession = useCallback(
    (duration: SessionDuration) => dispatch({ type: 'SET_TIME_PER_SESSION', duration }),
    []
  );
  const setEquipmentPreset = useCallback(
    (preset: EquipmentPreset) => dispatch({ type: 'SET_EQUIPMENT_PRESET', preset }),
    []
  );
  const setUseCustomEquipment = useCallback(
    (useCustom: boolean) => dispatch({ type: 'SET_USE_CUSTOM_EQUIPMENT', useCustom }),
    []
  );
  const toggleEquipmentItem = useCallback(
    (item: string) => dispatch({ type: 'TOGGLE_EQUIPMENT_ITEM', item }),
    []
  );
  const setInjuries = useCallback(
    (injuries: string) => dispatch({ type: 'SET_INJURIES', injuries }),
    []
  );
  const toggleFocusArea = useCallback(
    (area: FocusArea) => dispatch({ type: 'TOGGLE_FOCUS_AREA', area }),
    []
  );
  const addAvoidExercise = useCallback(
    (exercise: string) => dispatch({ type: 'ADD_AVOID_EXERCISE', exercise }),
    []
  );
  const removeAvoidExercise = useCallback(
    (exercise: string) => dispatch({ type: 'REMOVE_AVOID_EXERCISE', exercise }),
    []
  );
  const startGeneration = useCallback(
    (jobId: string) => dispatch({ type: 'START_GENERATION', jobId }),
    []
  );
  const updateGenerationProgress = useCallback(
    (progress: number) => dispatch({ type: 'UPDATE_GENERATION_PROGRESS', progress }),
    []
  );
  const generationComplete = useCallback(
    (programId: string) => dispatch({ type: 'GENERATION_COMPLETE', programId }),
    []
  );
  const generationFailed = useCallback(
    (error: string) => dispatch({ type: 'GENERATION_FAILED', error }),
    []
  );
  const clearGenerationError = useCallback(
    () => dispatch({ type: 'CLEAR_GENERATION_ERROR' }),
    []
  );
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  const value: ProgramWizardContextValue = {
    state,
    dispatch,
    goNext,
    goBack,
    goToStep,
    canGoNext,
    canGoBack,
    setGoal,
    setExperienceLevel,
    setDurationWeeks,
    setSessionsPerWeek,
    togglePreferredDay,
    setTimePerSession,
    setEquipmentPreset,
    setUseCustomEquipment,
    toggleEquipmentItem,
    setInjuries,
    toggleFocusArea,
    addAvoidExercise,
    removeAvoidExercise,
    startGeneration,
    updateGenerationProgress,
    generationComplete,
    generationFailed,
    clearGenerationError,
    reset,
  };

  return (
    <ProgramWizardContext.Provider value={value}>{children}</ProgramWizardContext.Provider>
  );
}

// Custom hook
export function useProgramWizard(): ProgramWizardContextValue {
  const context = useContext(ProgramWizardContext);
  if (!context) {
    throw new Error('useProgramWizard must be used within a ProgramWizardProvider');
  }
  return context;
}
