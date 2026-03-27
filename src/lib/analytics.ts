/**
 * PostHog Analytics — AMA-1348
 *
 * Tracks key user events for product analytics.
 * Only initializes when VITE_POSTHOG_KEY is set.
 *
 * Usage:
 *   import { analytics } from './analytics';
 *   analytics.trackWorkoutImported('instagram', 'video');
 */
import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.posthog.com';

// Initialize PostHog (only if key is configured)
if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
  });
}

export const analytics = {
  /** Track workout imported from external source */
  trackWorkoutImported(source: string, format: string) {
    posthog.capture('workout_imported', { source, format });
  },

  /** Track workout pushed to wearable device */
  trackWorkoutPushed(device: string, success: boolean, stepCount?: number) {
    posthog.capture('workout_pushed', { device, success, step_count: stepCount });
  },

  /** Track AI coach message sent */
  trackAICoachMessage(model?: string, tokens?: number) {
    posthog.capture('ai_coach_message', { model, tokens });
  },

  /** Track training plan generated */
  trackPlanGenerated(duration?: number, exerciseCount?: number) {
    posthog.capture('plan_generated', { duration_ms: duration, exercise_count: exerciseCount });
  },

  /** Track exercise completed in a workout */
  trackExerciseCompleted(exerciseType: string, weight?: number, reps?: number, sets?: number) {
    posthog.capture('exercise_completed', { exercise_type: exerciseType, weight, reps, sets });
  },

  /** Track workout session started */
  trackSessionStarted(workoutType?: string, source?: string) {
    posthog.capture('session_started', { workout_type: workoutType, source });
  },

  /** Track workout session ended */
  trackSessionEnded(durationMinutes?: number, exerciseCount?: number) {
    posthog.capture('session_ended', { duration_minutes: durationMinutes, exercise_count: exerciseCount });
  },

  /** Track navigation to a specific view */
  trackPageView(view: string) {
    posthog.capture('$pageview', { view });
  },

  /** Identify user (call after login) */
  identifyUser(userId: string, properties?: Record<string, unknown>) {
    posthog.identify(userId, properties);
  },

  /** Reset user identity (call on logout) */
  reset() {
    posthog.reset();
  },
};
