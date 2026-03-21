/**
 * Standalone preview entry point for TrainingPreferencesPage.
 * Served at /training-preferences-preview.html during dev.
 *
 * AMA-1129: Renders training preferences in various states for Playwright screenshots.
 *
 * Modes (via ?mode= query param):
 * - default: Default preferences (no changes)
 * - custom-volume: Custom volume slider visible, goal race selected with date
 */
import { createRoot } from 'react-dom/client';
import { useEffect } from 'react';
import './index.css';
import { TrainingPreferencesPage } from './components/TrainingPreferences/TrainingPreferencesPage';

const STORAGE_KEY = 'amakaflow-training-preferences';

function seedCustomVolumeState() {
  const prefs = {
    weeklyVolumePreset: 'custom',
    weeklyVolumeCustomHours: 8,
    hardDaysPerWeek: 3,
    maxSessionLengthMinutes: 120,
    preferredRunDays: ['mon', 'wed', 'fri', 'sat', 'sun'],
    preferredWorkoutTime: 'evening',
    goalRace: 'half-marathon',
    goalRaceDate: '2026-09-20',
    deloadInterval: 3,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') || 'default';

  useEffect(() => {
    if (mode === 'custom-volume') {
      seedCustomVolumeState();
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [mode]);

  return (
    <TrainingPreferencesPage onBack={() => console.log('back clicked')} />
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}
