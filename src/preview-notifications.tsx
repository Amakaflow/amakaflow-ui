/**
 * Standalone preview entry point for NotificationPreferencesPage.
 *
 * AMA-1132: Renders notification preferences for Playwright screenshots.
 *
 * Modes (via ?mode= query param):
 * - full: All toggles enabled (default)
 * - partial: Some toggles disabled
 * - banner: Shows the notification banner
 */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { NotificationPreferencesPage } from './components/Notifications/NotificationPreferencesPage';
import { NotificationBanner } from './components/Notifications/NotificationBanner';
import { NotificationPreferences } from './hooks/useNotifications';

const FULL_PREFS: NotificationPreferences = {
  user_id: 'preview-user',
  workout_reminders: true,
  sync_alerts: true,
  conflict_warnings: true,
  readiness_alerts: true,
  weekly_summary: true,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
};

const PARTIAL_PREFS: NotificationPreferences = {
  ...FULL_PREFS,
  sync_alerts: false,
  readiness_alerts: false,
  quiet_hours_start: '23:00',
  quiet_hours_end: '06:00',
};

function App() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') || 'full';

  const initialPrefs = mode === 'partial' ? PARTIAL_PREFS : FULL_PREFS;
  const [prefs, setPrefs] = useState(initialPrefs);

  const handleToggle = (key: string, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const handleQuietHoursChange = (start: string, end: string) => {
    setPrefs((prev) => ({ ...prev, quiet_hours_start: start, quiet_hours_end: end }));
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 space-y-6">
        {mode === 'banner' && (
          <NotificationBanner
            permission="default"
            onEnable={async () => {
              // no-op in preview
            }}
          />
        )}
        <NotificationPreferencesPage
          preferences={prefs}
          onToggle={handleToggle}
          onQuietHoursChange={handleQuietHoursChange}
        />
      </div>
    </div>
  );
}

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<App />);
