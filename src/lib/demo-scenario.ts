/**
 * Demo scenario state — persisted to localStorage so it survives navigation.
 *
 * Controls which mock data set the bulk import API returns.
 * Set via the DEMO floating button in DemoNav.
 */

export type ImportScenario = 'ppl-program' | 'messy-csv' | 'large-program' | 'single-workout';

const STORAGE_KEY = 'amakaflow-demo-import-scenario';

function readScenario(): ImportScenario {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'messy-csv' || stored === 'large-program' || stored === 'single-workout') {
      return stored;
    }
  } catch {
    // localStorage unavailable (SSR / private browsing edge cases)
  }
  return 'ppl-program';
}

let _current: ImportScenario = readScenario();

export function getImportScenario(): ImportScenario {
  return _current;
}

export function setImportScenario(scenario: ImportScenario): void {
  _current = scenario;
  try {
    localStorage.setItem(STORAGE_KEY, scenario);
  } catch {
    // ignore
  }
}

export const IMPORT_SCENARIO_LABELS: Record<ImportScenario, string> = {
  'ppl-program': 'PPL Program (Excel)',
  'messy-csv': 'Messy CSV',
  'large-program': 'Large Program (8 workouts)',
  'single-workout': 'Single Workout',
};
