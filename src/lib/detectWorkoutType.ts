/**
 * AMA-208: Smart workout type detection with user confirmation.
 *
 * Analyzes workout text or a parsed workout structure to auto-detect the type
 * (strength, HIIT, cardio, running, yoga, circuit, etc.)
 * and returns a confidence score for the detection.
 */

import type { WorkoutType, WorkoutStructure } from '../types/workout';

export interface WorkoutTypeDetectionResult {
  detectedType: WorkoutType;
  confidence: number; // 0.0 - 1.0
  reason: string;     // Human-readable explanation
}

// Keyword patterns for each workout type
const TYPE_KEYWORDS: Record<WorkoutType, string[]> = {
  strength: [
    'bench press', 'squat', 'deadlift', 'overhead press', 'barbell',
    'dumbbell', 'curl', 'row', 'lat pulldown', 'press', 'fly', 'flye',
    'skull crusher', 'extension', 'shrug', 'pull-up', 'pullup', 'chin-up',
    'push-up', 'pushup', 'sets', 'reps', 'RPE', 'RM', '1RM', 'hypertrophy',
    'powerlifting', 'bodybuilding', 'smith machine', 'cable',
  ],
  hiit: [
    'hiit', 'high intensity', 'tabata', 'interval', 'work/rest',
    'on/off', 'seconds on', 'seconds off', 'burpee', 'jump',
    'sprint', 'explosive', 'plyometric', 'metabolic',
  ],
  cardio: [
    'cardio', 'cycling', 'bike', 'elliptical', 'stairmaster',
    'rowing', 'swim', 'aerobic', 'steady state', 'endurance',
    'heart rate', 'zone 2', 'zone 3',
  ],
  running: [
    'run', 'running', 'jog', 'tempo', 'fartlek', 'interval run',
    'easy pace', 'race pace', 'marathon', 'half marathon', '5k', '10k',
    'treadmill', 'mile', 'km', 'recovery jog', 'threshold',
    'stride', 'warm-up jog', 'cooldown jog',
  ],
  yoga: [
    'yoga', 'vinyasa', 'ashtanga', 'hatha', 'flow', 'sun salutation',
    'downward dog', 'warrior', 'pose', 'asana', 'stretch', 'flexibility',
    'mobility', 'breathwork', 'pranayama', 'namaste', 'savasana',
    'pigeon', 'plank hold', 'child pose',
  ],
  circuit: [
    'circuit', 'round', 'amrap', 'emom', 'for time', 'crossfit',
    'wod', 'metcon', 'rounds for time', 'station',
  ],
  follow_along: [
    'follow along', 'video', 'youtube', 'instagram', 'tiktok',
  ],
  mixed: [],
};

/**
 * Detect workout type from raw text input (e.g., pasted AI text).
 */
export function detectWorkoutTypeFromText(text: string): WorkoutTypeDetectionResult {
  const lowerText = text.toLowerCase();
  const scores: Record<WorkoutType, number> = {
    strength: 0,
    hiit: 0,
    cardio: 0,
    running: 0,
    yoga: 0,
    circuit: 0,
    follow_along: 0,
    mixed: 0,
  };

  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS) as [WorkoutType, string[]][]) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        scores[type] += 1;
      }
    }
  }

  // Find the type with the highest score
  let bestType: WorkoutType = 'mixed';
  let bestScore = 0;
  let totalHits = 0;

  for (const [type, score] of Object.entries(scores) as [WorkoutType, number][]) {
    totalHits += score;
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  // Calculate confidence
  let confidence = 0;
  if (totalHits > 0) {
    confidence = Math.min(bestScore / Math.max(totalHits, 1), 1.0);
    // Boost confidence if many keywords matched
    if (bestScore >= 5) confidence = Math.min(confidence + 0.2, 1.0);
    if (bestScore >= 3) confidence = Math.min(confidence + 0.1, 1.0);
  }

  if (bestScore === 0) {
    return { detectedType: 'mixed', confidence: 0.3, reason: 'No clear type indicators found' };
  }

  return {
    detectedType: bestType,
    confidence: Math.round(confidence * 100) / 100,
    reason: `Detected ${bestScore} ${bestType}-related keywords`,
  };
}

/**
 * Detect workout type from a parsed WorkoutStructure.
 */
export function detectWorkoutTypeFromStructure(workout: WorkoutStructure): WorkoutTypeDetectionResult {
  // If the workout already has a type from the API, use it
  if (workout.workout_type && workout.workout_type !== 'mixed') {
    return {
      detectedType: workout.workout_type,
      confidence: workout.workout_type_confidence ?? 0.85,
      reason: 'Type detected by AI parser',
    };
  }

  // Build text from exercise names and blocks
  const textParts: string[] = [workout.title || ''];
  for (const block of workout.blocks || []) {
    textParts.push(block.label || '');
    for (const ex of block.exercises || []) {
      textParts.push(ex.name || '');
      textParts.push(ex.type || '');
    }
    for (const ss of block.supersets || []) {
      for (const ex of ss.exercises || []) {
        textParts.push(ex.name || '');
        textParts.push(ex.type || '');
      }
    }
    // Structure hints
    if (block.structure) textParts.push(block.structure);
  }

  return detectWorkoutTypeFromText(textParts.join(' '));
}

/**
 * Get a user-friendly confirmation message for the detected type.
 */
export function getDetectionConfirmationMessage(result: WorkoutTypeDetectionResult): string {
  const typeLabels: Record<WorkoutType, string> = {
    strength: 'Strength',
    hiit: 'HIIT',
    cardio: 'Cardio',
    running: 'Running',
    yoga: 'Yoga',
    circuit: 'Circuit',
    follow_along: 'Follow Along',
    mixed: 'Mixed',
  };
  return `This looks like a ${typeLabels[result.detectedType]} workout. Is that right?`;
}
