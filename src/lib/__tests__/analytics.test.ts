import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock posthog
vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  },
}));

import { analytics } from '../analytics';
import posthog from 'posthog-js';

describe('analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('trackWorkoutImported calls posthog.capture', () => {
    analytics.trackWorkoutImported('instagram', 'video');
    expect(posthog.capture).toHaveBeenCalledWith('workout_imported', { source: 'instagram', format: 'video' });
  });

  it('trackWorkoutPushed includes device and success', () => {
    analytics.trackWorkoutPushed('garmin', true, 8);
    expect(posthog.capture).toHaveBeenCalledWith('workout_pushed', { device: 'garmin', success: true, step_count: 8 });
  });

  it('trackAICoachMessage includes model and tokens', () => {
    analytics.trackAICoachMessage('sonnet', 1500);
    expect(posthog.capture).toHaveBeenCalledWith('ai_coach_message', { model: 'sonnet', tokens: 1500 });
  });

  it('trackSessionStarted captures workout type', () => {
    analytics.trackSessionStarted('strength', 'manual');
    expect(posthog.capture).toHaveBeenCalledWith('session_started', { workout_type: 'strength', source: 'manual' });
  });

  it('identifyUser calls posthog.identify', () => {
    analytics.identifyUser('user-123', { plan: 'pro' });
    expect(posthog.identify).toHaveBeenCalledWith('user-123', { plan: 'pro' });
  });

  it('reset calls posthog.reset', () => {
    analytics.reset();
    expect(posthog.reset).toHaveBeenCalled();
  });
});
