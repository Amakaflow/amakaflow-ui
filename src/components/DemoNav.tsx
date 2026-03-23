// src/components/DemoNav.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isDemoMode } from '../lib/demo-mode';
import {
  getImportScenario,
  setImportScenario,
  IMPORT_SCENARIO_LABELS,
  type ImportScenario,
} from '../lib/demo-scenario';
import { VIEW_TO_PATH, pathToView } from '../hooks/useUrlSync';
import type { View } from '../app/router';

const VIEWS: { id: View; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'workflow', label: 'New Workout Flow' },
  { id: 'workouts', label: 'Workouts' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'programs', label: 'Programs' },
  { id: 'create-ai', label: 'AI Workout Creator' },
  { id: 'import', label: 'Import' },
  { id: 'mobile-companion', label: 'Mobile Companion' },
  { id: 'team', label: 'Team Sharing' },
  { id: 'help', label: 'Help' },
  { id: 'settings', label: 'Settings' },
];

const SCENARIOS = Object.entries(IMPORT_SCENARIO_LABELS) as [ImportScenario, string][];

export interface DemoNavProps {
  /** @deprecated Props are no longer needed; DemoNav uses react-router internally. */
  onNavigate?: (view: string) => void;
  /** @deprecated Props are no longer needed; DemoNav uses react-router internally. */
  currentView?: string;
}

export function DemoNav({ onNavigate: _onNavigate, currentView: _currentView }: DemoNavProps = {}) {
  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState<ImportScenario>(getImportScenario);
  const nav = useNavigate();
  const location = useLocation();
  const currentView = pathToView(location.pathname);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'D') setOpen(prev => !prev);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!isDemoMode) return null;

  function handleScenarioChange(s: ImportScenario) {
    setImportScenario(s);
    setScenario(s);
  }

  function handleNavigate(view: View) {
    const path = VIEW_TO_PATH[view] || '/';
    nav(path);
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="fixed bottom-4 right-4 z-[51] bg-orange-700 text-white text-xs font-bold px-3 py-2 rounded-full shadow-lg hover:bg-orange-800 transition-colors"
        title="Demo Nav (Shift+D)"
      >
        DEMO
      </button>
      {open && (
        <div className="fixed bottom-16 right-4 z-50 bg-white border border-border rounded-xl shadow-2xl p-4 w-64">

          {/* Import scenario picker */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Import Scenario
          </p>
          <div className="flex flex-col gap-1 mb-4">
            {SCENARIOS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => handleScenarioChange(id)}
                className={`text-left text-sm px-3 py-1.5 rounded-lg hover:bg-muted transition-colors ${
                  scenario === id ? 'bg-orange-50 text-orange-700 font-medium ring-1 ring-orange-200' : ''
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="border-t border-border mb-3" />

          {/* View jump list */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Jump to screen
          </p>
          <div className="flex flex-col gap-1">
            {VIEWS.map(v => (
              <button
                key={v.id}
                onClick={() => handleNavigate(v.id)}
                className={`text-left text-sm px-3 py-1.5 rounded-lg hover:bg-muted transition-colors ${
                  currentView === v.id ? 'bg-muted font-medium' : ''
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
