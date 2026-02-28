// src/components/DemoNav.tsx
import { useState, useEffect } from 'react';
import { isDemoMode } from '../lib/demo-mode';

// NOTE: Matches the View type defined in App.tsx
type DemoView = 'home' | 'workflow' | 'profile' | 'analytics' | 'team' | 'settings' | 'strava-enhance' | 'calendar' | 'workouts' | 'mobile-companion' | 'bulk-import' | 'help' | 'exercise-history' | 'volume-analytics' | 'program-detail' | 'programs' | 'create-ai';

const VIEWS: { id: DemoView; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'workflow', label: 'New Workout Flow' },
  { id: 'workouts', label: 'Workouts' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'volume-analytics', label: 'Volume Analytics' },
  { id: 'programs', label: 'Programs' },
  { id: 'create-ai', label: 'AI Workout Creator' },
  { id: 'bulk-import', label: 'Bulk Import' },
  { id: 'exercise-history', label: 'Exercise History' },
  { id: 'mobile-companion', label: 'Mobile Companion' },
  { id: 'team', label: 'Team Sharing' },
  { id: 'help', label: 'Help' },
  { id: 'settings', label: 'Settings' },
];

interface DemoNavProps {
  onNavigate: (view: DemoView) => void;
  currentView: string;
}

export function DemoNav({ onNavigate, currentView }: DemoNavProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'D') setOpen(prev => !prev);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!isDemoMode) return null;

  return (
    <>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="fixed bottom-4 right-4 z-50 bg-orange-500 text-white text-xs font-bold px-3 py-2 rounded-full shadow-lg hover:bg-orange-600 transition-colors"
        title="Demo Nav (Shift+D)"
      >
        DEMO
      </button>
      {open && (
        <div className="fixed bottom-16 right-4 z-50 bg-white border border-border rounded-xl shadow-2xl p-4 w-56">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Jump to screen
          </p>
          <div className="flex flex-col gap-1">
            {VIEWS.map(v => (
              <button
                key={v.id}
                onClick={() => { onNavigate(v.id); setOpen(false); }}
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
