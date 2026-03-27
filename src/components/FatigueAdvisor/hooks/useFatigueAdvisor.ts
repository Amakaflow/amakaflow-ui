/**
 * useFatigueAdvisor — manages fatigue advice API calls with demo mock.
 *
 * AMA-1114: In demo mode (default), returns a pre-answered fatigue question
 * about quadriceps after HYROX. In production, calls POST /coach/fatigue-advice.
 */

import { useState, useCallback } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface FatigueAdvice {
  likely_cause: string;
  immediate_recovery: string[];
  programming_suggestions: string[];
  related_exercises: string[];
  rest_recommendation: string;
}

export interface UseFatigueAdvisorOptions {
  demoMode?: boolean;
}

export interface UseFatigueAdvisorReturn {
  advice: FatigueAdvice | null;
  isLoading: boolean;
  error: string | null;
  askQuestion: (question: string) => Promise<void>;
  reset: () => void;
  lastQuestion: string | null;
}

// =============================================================================
// Demo Mock Data
// =============================================================================

const DEMO_ADVICE: Record<string, FatigueAdvice> = {
  quads: {
    likely_cause:
      'Eccentric overload on the quadriceps during HYROX wall balls, sled push, and lunges. The repetitive eccentric contractions cause micro-tears in the muscle fibers, leading to delayed onset muscle soreness (DOMS).',
    immediate_recovery: [
      'Quad stretch 2x30s each leg — hold gentle, no bouncing',
      'Foam roll quads and IT band 90s each side',
      'Ice bath or cold water immersion 10-15 min',
      'Elevate legs for 10 min to reduce swelling',
    ],
    programming_suggestions: [
      'Add tempo squats (3s eccentric) to build eccentric strength',
      'Include Nordic hamstring curls to balance quad dominance',
      'Progress to Bulgarian split squats for single-leg stability',
    ],
    related_exercises: [
      'Bulgarian split squat',
      'Step-up with knee drive',
      'Wall sit',
      'Leg extension (light)',
      'Cyclist squat',
    ],
    rest_recommendation:
      '48-72h before next heavy lower body session. Light walking or cycling is fine for active recovery.',
  },
  hamstrings: {
    likely_cause:
      'Hamstring fatigue from hip-dominant movements like deadlifts and running. The hamstrings work eccentrically during the swing phase of running and concentrically during hip extension.',
    immediate_recovery: [
      'Standing hamstring stretch 2x30s each leg',
      'Foam roll hamstrings and glutes 60s each side',
      'Gentle walking for 10-15 min to promote blood flow',
    ],
    programming_suggestions: [
      'Add Romanian deadlifts with slow eccentric (3-4s lowering)',
      'Include glute bridges to share load with glutes',
      'Incorporate single-leg deadlifts for stability',
    ],
    related_exercises: [
      'Romanian deadlift',
      'Glute-ham raise',
      'Nordic hamstring curl',
      'Single-leg deadlift',
      'Kettlebell swing',
    ],
    rest_recommendation:
      '48h before next posterior chain session. Avoid sprinting or hill runs during recovery.',
  },
  default: {
    likely_cause:
      'Muscle fatigue from accumulated training stress. When muscles are repeatedly loaded beyond their current capacity, micro-damage occurs that requires adequate recovery to repair and strengthen.',
    immediate_recovery: [
      'Static stretching of the affected area 2x30s',
      'Foam rolling for 60-90s on tight spots',
      'Light movement or walking for 15 min',
      'Adequate hydration and protein intake within 2h',
    ],
    programming_suggestions: [
      'Reduce volume by 20% for the affected muscle group this week',
      'Add targeted mobility work to warm-up routine',
      'Consider progressive overload adjustments',
    ],
    related_exercises: [
      'Bodyweight variations of the fatiguing exercise',
      'Stability work targeting supporting muscles',
      'Mobility drills for the affected joints',
    ],
    rest_recommendation:
      '24-48h before training the same muscle group again. Prioritize sleep quality.',
  },
};

function getDemoAdvice(question: string): FatigueAdvice {
  const lower = question.toLowerCase();
  if (lower.includes('quad') || lower.includes('thigh') || lower.includes('hyrox') || lower.includes('lunge')) {
    return DEMO_ADVICE.quads;
  }
  if (lower.includes('hamstring') || lower.includes('deadlift') || lower.includes('posterior')) {
    return DEMO_ADVICE.hamstrings;
  }
  return DEMO_ADVICE.default;
}

// =============================================================================
// Hook
// =============================================================================

export function useFatigueAdvisor({
  demoMode = true,
}: UseFatigueAdvisorOptions = {}): UseFatigueAdvisorReturn {
  const [advice, setAdvice] = useState<FatigueAdvice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);

  const askQuestion = useCallback(
    async (question: string) => {
      setIsLoading(true);
      setError(null);
      setAdvice(null);
      setLastQuestion(question);

      if (demoMode) {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400));
        setAdvice(getDemoAdvice(question));
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/coach/fatigue-advice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const data: FatigueAdvice = await response.json();
        setAdvice(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get advice');
      } finally {
        setIsLoading(false);
      }
    },
    [demoMode],
  );

  const reset = useCallback(() => {
    setAdvice(null);
    setError(null);
    setLastQuestion(null);
  }, []);

  return {
    advice,
    isLoading,
    error,
    askQuestion,
    reset,
    lastQuestion,
  };
}
