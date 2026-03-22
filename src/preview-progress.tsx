/**
 * Standalone preview entry point for ProgressView (AMA-1154).
 * Served at /progress-preview.html during dev.
 */
import { createRoot } from 'react-dom/client';
import './index.css';
import { ProgressPreview } from './components/ProgressView/ProgressPreview';

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(
    <div className="dark bg-background text-foreground min-h-screen">
      <ProgressPreview />
    </div>,
  );
}
