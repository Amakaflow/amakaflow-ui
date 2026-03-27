/**
 * Hook for fetching shoe comparison data (AMA-1112).
 *
 * Uses demo mock data by default; when the backend endpoint is available,
 * uncomment the fetch path.
 */

import { useState, useEffect } from 'react';

export interface ShoeStats {
  shoe_name: string;
  total_runs: number;
  total_km: number;
  avg_pace_per_km: number; // seconds
  avg_power: number; // watts
  avg_form_power: number; // watts
  avg_leg_spring_stiffness: number; // kN/m
  avg_vertical_oscillation: number; // cm
  avg_hr: number; // bpm
  best_for: string[];
}

export interface ShoeComparisonData {
  shoes: ShoeStats[];
  total_runs_analyzed: number;
  recommendation: string;
}

const MOCK_DATA: ShoeComparisonData = {
  shoes: [
    {
      shoe_name: 'Nike Vaporfly 3',
      total_runs: 42,
      total_km: 378.5,
      avg_pace_per_km: 268,
      avg_power: 248,
      avg_form_power: 62,
      avg_leg_spring_stiffness: 10.8,
      avg_vertical_oscillation: 7.2,
      avg_hr: 155,
      best_for: ['race', 'tempo'],
    },
    {
      shoe_name: 'Asics Novablast 4',
      total_runs: 67,
      total_km: 536.8,
      avg_pace_per_km: 312,
      avg_power: 232,
      avg_form_power: 58,
      avg_leg_spring_stiffness: 9.4,
      avg_vertical_oscillation: 8.1,
      avg_hr: 142,
      best_for: ['easy', 'long run', 'recovery'],
    },
    {
      shoe_name: 'Hoka Mach 6',
      total_runs: 35,
      total_km: 262.5,
      avg_pace_per_km: 285,
      avg_power: 241,
      avg_form_power: 60,
      avg_leg_spring_stiffness: 10.2,
      avg_vertical_oscillation: 7.6,
      avg_hr: 149,
      best_for: ['intervals', 'fartlek'],
    },
  ],
  total_runs_analyzed: 144,
  recommendation:
    'Nike Vaporfly 3 is your fastest shoe for races and tempo runs. ' +
    'Asics Novablast 4 keeps HR lowest on easy days. ' +
    'Hoka Mach 6 delivers the best power efficiency for interval work.',
};

interface UseShoeComparisonResult {
  data: ShoeComparisonData | null;
  isLoading: boolean;
  error: Error | null;
}

export function useShoeComparison(): UseShoeComparisonResult {
  const [data, setData] = useState<ShoeComparisonData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        // TODO: Replace with real API call when backend is deployed
        // const res = await fetch('/api/analytics/shoe-comparison');
        // const json = await res.json();
        await new Promise((r) => setTimeout(r, 300)); // simulate network
        if (!cancelled) {
          setData(MOCK_DATA);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading, error };
}
