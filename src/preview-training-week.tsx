/**
 * Standalone preview entry point for TrainingWeekView.
 * Served at /training-week-preview.html during dev.
 */
import { createRoot } from 'react-dom/client';
import './index.css';
import { TrainingWeekView } from './components/Calendar/TrainingWeekView';

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(
    <div className="dark bg-background text-foreground min-h-screen">
      <TrainingWeekView />
    </div>,
  );
}
