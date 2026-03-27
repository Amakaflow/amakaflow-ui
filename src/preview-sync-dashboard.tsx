/**
 * Standalone preview entry point for SyncDashboard.
 * Served at /sync-dashboard-preview.html during dev.
 *
 * AMA-1127: Renders sync dashboard for Playwright screenshots.
 *
 * Modes (via ?mode= query param):
 * - full: Full dashboard with all 3 sections (default)
 * - resolved: Dashboard after resolving first decision
 */
import { createRoot } from 'react-dom/client';
import './index.css';
import { SyncDashboard } from './components/SyncDashboard/SyncDashboard';

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <SyncDashboard />
      </div>
    </div>
  );
}

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<App />);
