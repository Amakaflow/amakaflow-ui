/**
 * AMA-210 & AMA-211: Types for workout playback modifications.
 *
 * Supports mid-workout skip/reorder/replace and pre-workout customization.
 */

import type { Exercise, Block } from './workout';

// =============================================================================
// AMA-210: Mid-workout modifications
// =============================================================================

/** Actions available during workout playback */
export type PlaybackAction =
  | 'skip'          // Skip the current exercise
  | 'reorder'       // Reorder remaining exercises
  | 'replace'       // Replace current exercise with alternative
  | 'extend_rest'   // Extend rest period
  | 'shorten_rest'; // Shorten rest period

/** Result of a skip action */
export interface SkipResult {
  action: 'skip';
  exerciseId: string;
  exerciseName: string;
  reason?: SkipReason;
}

export type SkipReason =
  | 'equipment_unavailable'
  | 'injury'
  | 'fatigue'
  | 'time_constraint'
  | 'user_choice';

/** Result of a replace action */
export interface ReplaceResult {
  action: 'replace';
  originalExerciseId: string;
  originalName: string;
  replacementExercise: Exercise;
  reason?: string;
}

/** Result of a reorder action */
export interface ReorderResult {
  action: 'reorder';
  /** New order of exercise IDs for remaining exercises */
  newOrder: string[];
}

/** Union of all modification results */
export type PlaybackModification = SkipResult | ReplaceResult | ReorderResult;

/** Log entry for tracking mid-workout modifications */
export interface PlaybackModificationLog {
  timestamp: number;
  stepIndex: number;
  modification: PlaybackModification;
}

/**
 * Alternative exercise suggestion for replacement.
 * These come from the exercise database/API.
 */
export interface AlternativeExercise {
  exercise: Exercise;
  /** Why this is a good alternative (e.g., "same muscle group") */
  reason: string;
  /** Similarity score 0-1 */
  similarity: number;
}

// =============================================================================
// AMA-211: Pre-workout reorder
// =============================================================================

/** Represents a draggable exercise item in pre-workout reorder */
export interface DraggableExerciseItem {
  id: string;
  blockIndex: number;
  exerciseIndex: number;
  exercise: Exercise;
  /** Label like "Block A" for display */
  blockLabel: string;
}

/** Payload for drag-and-drop reorder events */
export interface ReorderEvent {
  /** ID of the exercise being moved */
  exerciseId: string;
  /** Source position */
  fromBlockIndex: number;
  fromExerciseIndex: number;
  /** Destination position */
  toBlockIndex: number;
  toExerciseIndex: number;
}

/** State of the pre-workout customization */
export interface PreWorkoutCustomization {
  /** Modified blocks with user's custom order */
  blocks: Block[];
  /** Whether any changes have been made */
  hasChanges: boolean;
  /** History of reorder operations for undo */
  history: ReorderEvent[];
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Create a default PreWorkoutCustomization from blocks
 */
export function createPreWorkoutCustomization(blocks: Block[]): PreWorkoutCustomization {
  return {
    blocks: blocks.map(b => ({ ...b })),
    hasChanges: false,
    history: [],
  };
}

/**
 * Apply a reorder event to blocks
 */
export function applyReorder(
  blocks: Block[],
  event: ReorderEvent
): Block[] {
  const newBlocks = blocks.map(b => ({
    ...b,
    exercises: [...b.exercises],
  }));

  const sourceBlock = newBlocks[event.fromBlockIndex];
  const destBlock = newBlocks[event.toBlockIndex];

  if (!sourceBlock || !destBlock) return blocks;

  const [movedExercise] = sourceBlock.exercises.splice(event.fromExerciseIndex, 1);
  if (!movedExercise) return blocks;

  destBlock.exercises.splice(event.toExerciseIndex, 0, movedExercise);

  return newBlocks;
}

/**
 * Flatten blocks into a list of draggable items for the reorder UI
 */
export function flattenToDraggableItems(blocks: Block[]): DraggableExerciseItem[] {
  const items: DraggableExerciseItem[] = [];
  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    for (let ei = 0; ei < block.exercises.length; ei++) {
      const exercise = block.exercises[ei];
      items.push({
        id: exercise.id,
        blockIndex: bi,
        exerciseIndex: ei,
        exercise,
        blockLabel: block.label,
      });
    }
  }
  return items;
}
