/**
 * Standalone preview entry point for WorkoutImportModal.
 * Served at /workout-import-preview.html during dev.
 *
 * AMA-1130: Renders the modal in demo mode for Playwright screenshots.
 */
import { createRoot } from 'react-dom/client';
import './index.css';
import { WorkoutImportDemo } from './components/WorkoutImport/WorkoutImportDemo';

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(
    <div className="dark bg-background text-foreground min-h-screen">
      <WorkoutImportDemo />
    </div>,
  );
}
